const $ = (id) => document.getElementById(id);
const fields = ['name', 'headline', 'location', 'contact', 'summary', 'experience', 'skills', 'education', 'credentials'];
const stopWords = new Set('about after again also and are because been being build building but can could experience for from have include includes including into more most not our should skills that their them then there these they this through will with you your we who role looking required preferred responsibilities qualifications candidate candidates strong excellent ability work working years'.split(' '));
const skillPhrases = ['generative ai', 'machine learning', 'deep learning', 'data science', 'data engineering', 'computer vision', 'natural language processing', 'large language models', 'llm', 'rag', 'retrieval augmented generation', 'prompt engineering', 'fine-tuning', 'lora', 'qlora', 'peft', 'mlops', 'llmops', 'python', 'sql', 'pytorch', 'tensorflow', 'scikit-learn', 'xgboost', 'lightgbm', 'catboost', 'kubernetes', 'docker', 'gcp', 'aws', 'azure', 'vertex ai', 'spark', 'databricks', 'snowflake', 'airflow', 'faiss', 'vector database', 'a/b testing', 'hypothesis testing', 'causal inference', 'statistical modeling', 'recommendation systems', 'time series', 'nlp', 'transformers', 'bert', 'gpt', 'claude', 'gemini', 'vllm', 'model monitoring', 'ci/cd', 'stakeholder management', 'technical leadership', 'mentoring', 'product strategy', 'user research', 'figma', 'prototyping', 'design systems'];
const evidenceAliases = {
  'stakeholder management': ['stakeholder partnership', 'partnering with', 'stakeholders'],
  'technical leadership': ['technical ownership', 'mentor', 'mentoring', 'led '],
  'causal inference': ['causal analysis'],
  'recommendation systems': ['recommender systems', 'recommender system'],
  'large language models': ['llm', 'llms'],
  'natural language processing': ['nlp'],
};

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
    .map((word) => word.replace(/[.-]+$/g, ''))
    .filter((word) => word && !stopWords.has(word)))].slice(0, 80);
}

function requirementTerms(text) {
  const lower = text.toLowerCase();
  const phrases = skillPhrases.filter((phrase) => lower.includes(phrase));
  const words = keywords(text).filter((word) => !phrases.some((phrase) => phrase.includes(word)));
  const counts = Object.fromEntries(words.map((word) => [word, (lower.match(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length]));
  const repeated = words.filter((word) => counts[word] > 1).slice(0, 18);
  const meaningful = [...new Set([...phrases, ...repeated])];
  return (meaningful.length ? meaningful : words.slice(0, 12)).slice(0, 32)
    .map((term) => ({ term, weight: term.includes(' ') ? 3 : Math.min(3, counts[term] || 1) }));
}

function hasProfileEvidence(profileText, term) {
  return profileText.includes(term) || (evidenceAliases[term] || []).some((alias) => profileText.includes(alias));
}

function normalizeLines(text) {
  return text.replace(/\r/g, '').split('\n').map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/\bPage\s+\d+$/i.test(line));
}

const sectionNames = ['summary', 'profile', 'objective', 'professional summary', 'experience', 'professional experience', 'work experience', 'employment', 'skills', 'technical skills', 'core competencies', 'education', 'projects', 'certifications', 'achievements', 'awards', 'publications', 'publications and patent', 'education and awards'];

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

  const emailLine = lines.slice(0, 15).find((line) => line.includes('@')) || '';
  const phoneLine = lines.slice(0, 15).find((line) => (line.match(/\d/g) || []).length >= 8) || '';
  const email = (emailLine.replace(/\s/g, '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
  const phone = (phoneLine.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || text.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || [])[0] || '';
  const headerText = lines.slice(0, 15).join(' ');
  const urls = headerText.match(/(?:https?:\/\/[^\s]+|(?:linkedin\.com|github\.com|[\w.-]+\.github\.io)\/[^\s▪]+)/gi) || [];
  const locationLine = lines.slice(0, 10).find((line) => /,\s*(?:india|usa|united states|uk|canada|australia)\b/i.test(line));
  const location = locationLine?.split(/[▪•|]/)[0].trim() || '';
  const identityLines = lines.filter((line) => !sectionNames.includes(line.toLowerCase().replace(/[:|]/g, '').trim()) && !line.includes('@') && !/\d{6,}/.test(line));
  const name = identityLines.find((line) => line.length < 55 && /^[A-Za-z][A-Za-z .'-]+$/.test(line));
  const headline = identityLines.find((line) => line !== name && line.length < 90);
  const summary = extractSection(lines, ['summary', 'profile', 'objective', 'professional summary']);
  const experience = extractSection(lines, ['experience', 'professional experience', 'work experience', 'employment']);
  const skillText = extractSection(lines, ['skills', 'technical skills', 'core competencies']);
  const combinedEducation = extractSection(lines, ['education', 'education and awards']);
  const educationLines = combinedEducation.split('\n').filter((line) => !/award/i.test(line));
  const awardLines = combinedEducation.split('\n').filter((line) => /award/i.test(line));
  const credentials = [extractSection(lines, ['publications', 'publications and patent', 'certifications', 'achievements', 'awards']), ...awardLines].filter(Boolean).join('\n');

  if (name) $('name').value = name;
  if (headline) $('headline').value = headline;
  if (location) $('location').value = location;
  $('contact').value = [email, phone, ...urls.slice(0, 3)].filter(Boolean).join(' · ');
  $('summary').value = summary || lines.filter((line) => !isHeading(line) && line !== name && line !== headline && !line.includes('@') && !/(linkedin|github|https?:|\.com\b|\.io\b)/i.test(line) && line !== locationLine).slice(0, 4).join(' ');
  $('experience').value = experience || text;
  $('skills').value = skillText ? skillText.replace(/[•|·]/g, ',').replace(/\n/g, ', ') : '';
  $('education').value = educationLines.join('\n');
  $('credentials').value = credentials;
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
    const rows = [];
    content.items.filter((item) => item.str.trim()).forEach((item) => {
      const x = item.transform[4];
      const y = item.transform[5];
      let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, text: item.str.trim() });
    });
    pages.push(rows.sort((a, b) => b.y - a.y)
      .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
      .join('\n'));
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
  if (source.split(/\s+/).length < 25) {
    $('roleNote').textContent = 'Paste the complete job description so the coverage score is reliable.';
    return;
  }
  if (!profile.experience && !profile.summary) {
    $('roleNote').textContent = 'Upload a resume or add your experience before tailoring.';
    return;
  }

  const profileText = Object.values(profile).join(' ').toLowerCase();
  const requirements = requirementTerms(source);
  const matchedRequirements = requirements.filter(({ term }) => hasProfileEvidence(profileText, term));
  const selected = matchedRequirements.map(({ term }) => term).slice(0, 16);
  const sourceLower = source.toLowerCase();
  const profileSkills = profile.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
  const roleSkills = profileSkills.filter((skill) => {
    const skillLower = skill.toLowerCase();
    return sourceLower.includes(skillLower) || keywords(skill).some((word) => sourceLower.includes(word));
  });
  const competencyCandidates = selected.length >= 8 ? selected : [...selected, ...roleSkills];
  const relevantSkills = competencyCandidates.filter((skill, index, values) => values
    .findIndex((value) => value.toLowerCase() === skill.toLowerCase()) === index).slice(0, 20);
  const totalWeight = requirements.reduce((total, item) => total + item.weight, 0);
  const matchedWeight = matchedRequirements.reduce((total, item) => total + item.weight, 0);
  const score = Math.round((matchedWeight / Math.max(1, totalWeight)) * 100);
  const gaps = requirements.filter(({ term }) => !hasProfileEvidence(profileText, term)).map(({ term }) => term).slice(0, 6);
  const strengthLine = selected.length ? ` Relevant strengths for this role include ${selected.slice(0, 6).join(', ')}.` : '';

  $('matchScore').innerHTML = `${score}%<small>${score >= 90 ? 'target reached' : 'verified ATS coverage'}</small>`;
  $('keywords').innerHTML = (selected.length ? selected : ['No direct keyword matches yet'])
    .map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`).join('');
  $('gaps').innerHTML = (gaps.length ? gaps.map((gap) => `${gap} - add only if supported by your experience`) : ['No obvious keyword gaps - review for accuracy and readability.'])
    .map((gap) => `<li>${escapeHtml(gap)}</li>`).join('');
  const educationSection = profile.education ? `<h4>EDUCATION</h4><pre>${escapeHtml(profile.education)}</pre>` : '';
  const credentialsSection = profile.credentials ? `<h4>PUBLICATIONS, CERTIFICATIONS & AWARDS</h4><pre>${escapeHtml(profile.credentials)}</pre>` : '';
  $('resumePaper').innerHTML = `<header class="generated-header"><h3>${escapeHtml(profile.name)}</h3><div class="contact">${escapeHtml([profile.location, profile.contact].filter(Boolean).join(' · '))}</div></header><div class="resume-headline">${escapeHtml(profile.headline)}</div><p class="role-value">Targeted, evidence-based resume aligned to the selected opportunity</p><h4>PROFESSIONAL SUMMARY</h4><p>${escapeHtml(profile.summary + strengthLine)}</p><h4>CORE COMPETENCIES</h4><p class="competencies">${escapeHtml(relevantSkills.join(' · '))}</p><h4>PROFESSIONAL EXPERIENCE</h4><pre>${escapeHtml(rankExperience(profile.experience, selected))}</pre>${credentialsSection}${educationSection}`;
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
  anchor.download = `${safeCandidateName()}.txt`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function safeCandidateName() {
  return (getProfile().name || 'Tailored_Resume').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

function printResume() {
  const previousTitle = document.title;
  const fileName = safeCandidateName();
  document.title = fileName;
  $('roleNote').textContent = `Save as ${fileName}.pdf. In the print dialog, turn off Headers and footers.`;
  const restoreTitle = () => { document.title = previousTitle; };
  window.addEventListener('afterprint', restoreTitle, { once: true });
  window.print();
  setTimeout(restoreTitle, 60000);
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
$('print').addEventListener('click', printResume);
loadProfile();
