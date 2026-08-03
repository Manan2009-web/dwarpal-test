const { STUDENT_PROGRAMS, DEPARTMENTS } = require('../constants/appConstants');

function cleanString(val) {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9&]/g, '')
    .replace(/\s+/g, '');
}

const PROGRAM_ALIASES = {
  'diploma engineering': ['diploma', 'dip', 'diplomaengg', 'diplomaeng', 'di'],
  'degree engineering': ['degree', 'btech', 'be', 'degreeengineering', 'degreeengg', 'degreeeng', 'b.tech', 'b.e', 'b tech', 'b e'],
  'management studies': ['mba', 'bba', 'management', 'managementstudies', 'businessadministration', 'bms', 'pgdm'],
  'pharmacy': ['bpharm', 'bpharmacy', 'mpharm', 'mpharmacy', 'pharmacy', 'pharma', 'b.pharm', 'dpharm'],
  'computer applications': ['ca', 'mca', 'bca', 'computerapplications', 'computerapplication'],
  'science': ['science', 'bsc', 'msc', 'b.sc', 'm.sc'],
  'commerce': ['commerce', 'bcom', 'mcom', 'b.com', 'm.com'],
  'arts': ['arts', 'ba', 'ma', 'b.a', 'm.a']
};

const DEPT_ALIASES = {
  'computer engineering': ['comp', 'computer', 'cs', 'cse', 'computerengg', 'computereng', 'computerengineering', 'computerscience', 'compeng', 'compengg', 'compsci'],
  'information technology': ['it', 'informationtechnology', 'infotech', 'informationtech'],
  'mechanical engineering': ['mech', 'mechanical', 'mechengg', 'mecheng', 'mechanicalengg', 'mechanicalengineering'],
  'civil engineering': ['civil', 'civilengg', 'civileng', 'civilengineering'],
  'electrical engineering': ['elec', 'electrical', 'ee', 'electricalengg', 'electricaleng', 'electricalengineering'],
  'electronics & communication': ['ec', 'electronics', 'electronicsandcommunication', 'electronicscommunication', 'ece', 'electronicscommunicationengineering', 'electronicscommunicationengg', 'electronics&communication', 'electronics&communicationengg'],
  'artificial intelligence': ['ai', 'artificialintelligence', 'artificialintelligenceengineering', 'aiengg', 'aieng'],
  'data science': ['ds', 'datascience', 'datascienceengineering']
};

function getLevenshteinDistance(a, b) {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

function getSimilarity(a, b) {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  const dist = getLevenshteinDistance(a, b);
  return 1.0 - dist / maxLength;
}

function resolveValue(rawValue, canonicalList, aliasMap, valueType = 'Value') {
  const input = String(rawValue || '').trim();
  if (!input) {
    throw new Error(`${valueType} is required.`);
  }

  const cleanedInput = cleanString(input);

  // 1. Check exact match in canonical list
  for (const canonical of canonicalList) {
    if (cleanString(canonical) === cleanedInput) {
      return { canonical, original: input, isAutoCorrected: false };
    }
  }

  // 2. Check exact matches in aliases
  for (const canonical of canonicalList) {
    const aliases = aliasMap[canonical.toLowerCase()] || [];
    for (const alias of aliases) {
      if (cleanString(alias) === cleanedInput) {
        return { canonical, original: input, isAutoCorrected: true, correctedFrom: alias };
      }
    }
  }

  // 3. Substring match (high confidence)
  const substringCandidates = [];
  for (const canonical of canonicalList) {
    const cleanedCanonical = cleanString(canonical);
    if (cleanedInput.length >= 3 && (cleanedCanonical.includes(cleanedInput) || cleanedInput.includes(cleanedCanonical))) {
      substringCandidates.push({ canonical, score: Math.min(cleanedInput.length, cleanedCanonical.length) / Math.max(cleanedInput.length, cleanedCanonical.length) });
    }
    const aliases = aliasMap[canonical.toLowerCase()] || [];
    for (const alias of aliases) {
      const cleanedAlias = cleanString(alias);
      if (cleanedInput.length >= 3 && (cleanedAlias.includes(cleanedInput) || cleanedInput.includes(cleanedAlias))) {
        substringCandidates.push({ canonical, score: Math.min(cleanedInput.length, cleanedAlias.length) / Math.max(cleanedInput.length, cleanedAlias.length) });
      }
    }
  }

  // Sort substring matches by score descending
  substringCandidates.sort((a, b) => b.score - a.score);
  if (substringCandidates.length > 0 && substringCandidates[0].score >= 0.8) {
    if (substringCandidates.length === 1 || (substringCandidates[0].score - substringCandidates[1].score >= 0.15)) {
      return { canonical: substringCandidates[0].canonical, original: input, isAutoCorrected: true };
    }
  }

  // 4. Fuzzy match using Levenshtein distance
  const fuzzyCandidates = [];
  for (const canonical of canonicalList) {
    const cleanedCanonical = cleanString(canonical);
    const score = getSimilarity(cleanedInput, cleanedCanonical);
    fuzzyCandidates.push({ canonical, score });

    const aliases = aliasMap[canonical.toLowerCase()] || [];
    for (const alias of aliases) {
      const cleanedAlias = cleanString(alias);
      const score = getSimilarity(cleanedInput, cleanedAlias);
      fuzzyCandidates.push({ canonical, score });
    }
  }

  // Sort fuzzy candidates by score descending
  fuzzyCandidates.sort((a, b) => b.score - a.score);

  if (fuzzyCandidates.length > 0 && fuzzyCandidates[0].score >= 0.8) {
    if (fuzzyCandidates.length === 1 || (fuzzyCandidates[0].score - fuzzyCandidates[1].score >= 0.15)) {
      return { canonical: fuzzyCandidates[0].canonical, original: input, isAutoCorrected: true };
    }
  }

  throw new Error(`${valueType} value "${input}" could not be matched confidently. Please use one of: ${canonicalList.join(', ')}`);
}

function normalizeProgramField(value) {
  return resolveValue(value, STUDENT_PROGRAMS, PROGRAM_ALIASES, 'Program');
}

function normalizeDepartmentField(value) {
  return resolveValue(value, DEPARTMENTS, DEPT_ALIASES, 'Department');
}

module.exports = {
  normalizeProgramField,
  normalizeDepartmentField
};
