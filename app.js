const $ = (id) => document.getElementById(id);
const fields = ['name', 'headline', 'location', 'contact', 'summary', 'experience', 'skills'];
const stopWords = new Set('about after again also and are because been being but can could for from have into more most not our should that their them then there these they this through will with you your we who'.split(' '));

document.querySelectorAll('.toggle').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.toggle').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  $('textInput').classList.toggle('hidden', button.dataset.mode !== 'text');
  $('urlInput').classList.toggle('hidden', button.dataset.mode !== 'url');
}));

function getProfile() {
  return Object.fromEntries(fields.map((id) => [id, $(id).value.trim()]));
}

function saveProfile() {
  localStorage.setItem('rolefit-profile', JSON.stringify(getProfile()));
  $('roleNote').textContent = 'Saved in this browser · nothing uploaded';
}

function loadProfile() {
  try {
    const data = JSON.parse(localStorage.getItem('rolefit-profile'));
    if (data) fields.forEach((id) => { if (data[id]) $(id).value = data[id]; });
  } catch (_) {
    // Ignore malformed local data and keep the editable sample.
  }
}

function keywords(text) {
  return [...new Set((text.toLowerCase().match(/[a-z][a-z+#.-]{3,}/g) || [])
    .filter((word) => !stopWords.has(word)))].slice(0, 80);
}

function normalizeLines(text) {
  return text.replace(/\r/g, '').split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const sectionNames = ['summary', 'profile', 'objective', 'professional summary', 'experience', 'work experience', 'employment', 'skills', 'technical skills', 'core competencies', 'education', 'projects', 'certifications', 'achievements', 'awards'];

function isHeading(line) {
  const normalized = line.toLowerCase().replace(/[:|]/g, '').trim();
  return sectionNames.includes(normalized) || (line.length < 35 && line === line.toUpperCase() && /[A-Z]/.test(line));
}

function extractSection(lines, starts) {
  const start = lines.findIndex((line) => starts.includes(line.toLowerCase().replace(/[:|]/g, '').trim()));
  if (start < 0) return '';
  const collected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isHeading(lines[index])) break;
    collected.push(lines[index]);
  }
  return collected.join('\n').trim();
}

function fillProfileFromText(rawText, fileName) {
  const text = rawText.replace(/\u0000/g, '').trim();
  const lines = normalizeLines(text);
  if (text.length < 40 || lines.length < 3) throw new Error('Very little readable text was found in this file.');

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || '';
  const url = text.match(/https?:\/\/[^\s]+/i)?.[0] || '';
  const identityLines = lines.filter((line) => !isHeading(line) && !line.includes('@') && !/\d{6,}/.test(line));
  const name = identityLines.find((line) => line.length < 55 && /^[A-Za-z][A-Za-z .'-]+$/.test(line));
  const headline = identityLines.find((line) => line !== name && line.length < 90);
  const summary = extractSection(lines, ['summary', 'profile', 'objective', 'professional summary']);
  const experience = extractSection(lines, ['experience', 'work experience', 'employment']);
  const skillText = extractSection(lines, ['skills', 'technical skills', 'core competencies']);

  if (name) $('name').value = name;
  if (headline) $('headline').value = headline;
  $('contact').value = [email, phone, url].filter(Boolean).join(' · ');
  $('summary').value = summary || lines.filter((line) => !isHeading(line) && line !== name && line !== headline && !line.includes('@')).slice(0, 4).join(' ');
  $('experience').value = experience || text;
  $('skills').value = skillText ? skillText.replace(/[•|·]/g, ',').replace(/\n/g, ', ') : '';
  saveProfile();
  setUploadStatus(`Imported ${fileName}. Review the extracted fields, then add the job description.`, 'success');
}

function setUploadStatus(message, state = '') {
  $('uploadStatus').textContent = message;
  $('uploadStatus').className = `upload-status ${state}`.trim();
}

async function extractPdf(file) {
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

async function extractResume(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setUploadStatus('Please choose a resume smaller than 10 MB.', 'error');
    return;
  }
  const extension = file.name.split('.').pop().toLowerCase();
  setUploadStatus(`Reading ${file.name} locally…`);
  try {
    let text = '';
    if (extension === 'txt' || extension === 'md') text = await file.text();
    else if (extension === 'docx') {
      if (!window.mammoth) throw new Error('The DOCX reader could not load. Check your connection and retry.');
      text = (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } else if (extension === 'pdf') text = await extractPdf(file);
    else throw new Error('Unsupported file type. Use PDF, DOCX, TXT or Markdown.');
    fillProfileFromText(text, file.name);
  } catch (error) {
    setUploadStatus(error.message || 'The resume could not be read. Try a TXT or DOCX version.', 'error');
  }
}

function rankExperience(experience, roleWords) {
  const blocks = experience.split(/\n\s*\n/).filter(Boolean);
  if (blocks.length < 2) return experience;
  return blocks.map((block, index) => ({
    block,
    index,
    score: roleWords.reduce((total, word) => total + (block.toLowerCase().includes(word) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index).map(({ block }) => block).join('\n\n');
}

function tailor() {
  const profile = getProfile();
  const source = $('jobText').value.trim() || $('urlText').value.trim();
  if (!source) {
    $('roleNote').textContent = 'Add a job description or paste copied text from the link first.';
    return;
  }
  if (!profile.experience && !profile.summary) {
    $('roleNote').textContent = 'Upload a resume or add your experience before tailoring.';
    return;
  }

  const jdWords = keywords(source);
  const profileText = Object.values(profile).join(' ').toLowerCase();
  const matched = jdWords.filter((word) => profileText.includes(word));
  const selected = matched.slice(0, 14);
  const relevantSkills = profile.skills.split(',').map((skill) => skill.trim()).filter(Boolean)
    .sort((a, b) => Number(source.toLowerCase().includes(b.toLowerCase())) - Number(source.toLowerCase().includes(a.toLowerCase())));
  const score = Math.min(96, Math.max(20, Math.round((matched.length / Math.max(1, Math.min(jdWords.length, 30))) * 100)));
  const gaps = jdWords.filter((word) => !profileText.includes(word))
    .filter((word) => !['experience', 'design', 'product', 'team', 'work', 'using', 'years'].includes(word)).slice(0, 5);
  const strengthLine = selected.length ? ` Relevant strengths for this role include ${selected.slice(0, 6).join(', ')}.` : '';

  $('matchScore').innerHTML = `${score}%<small>keyword alignment</small>`;
  $('keywords').innerHTML = (selected.length ? selected : ['No direct keyword matches yet'])
    .map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`).join('');
  $('gaps').innerHTML = (gaps.length ? gaps : ['No obvious keyword gaps — review the full draft.'])
    .map((gap) => `<li>${escapeHtml(gap)}</li>`).join('');
  $('resumePaper').innerHTML = `<h3>${escapeHtml(profile.name)}</h3><div class="resume-headline">${escapeHtml(profile.headline)}</div><div class="contact">${escapeHtml([profile.location, profile.contact].filter(Boolean).join(' · '))}</div><h4>PROFESSIONAL SUMMARY</h4><p>${escapeHtml(profile.summary + strengthLine)}</p><h4>RELEVANT EXPERIENCE</h4><pre>${escapeHtml(rankExperience(profile.experience, selected))}</pre><h4>CORE SKILLS</h4><p>${escapeHtml(relevantSkills.join(' · '))}</p>`;
  $('output').classList.remove('hidden');
  $('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function download() {
  const text = $('resumePaper').innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'tailored-resume.txt';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

$('chooseFile').addEventListener('click', (event) => { event.stopPropagation(); $('resumeFile').click(); });
$('uploadZone').addEventListener('click', () => $('resumeFile').click());
$('uploadZone').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') $('resumeFile').click(); });
$('resumeFile').addEventListener('change', (event) => extractResume(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => $('uploadZone').addEventListener(eventName, (event) => { event.preventDefault(); $('uploadZone').classList.add('dragging'); }));
['dragleave', 'drop'].forEach((eventName) => $('uploadZone').addEventListener(eventName, (event) => { event.preventDefault(); $('uploadZone').classList.remove('dragging'); }));
$('uploadZone').addEventListener('drop', (event) => extractResume(event.dataTransfer.files[0]));
$('saveProfile').addEventListener('click', saveProfile);
$('tailor').addEventListener('click', tailor);
$('download').addEventListener('click', download);
$('print').addEventListener('click', () => window.print());
loadProfile();
