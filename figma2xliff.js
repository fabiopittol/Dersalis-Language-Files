const fs = require('node:fs');
const path = require('path');
const builder = require('xmlbuilder');

/* Defines the default language for the translation files 
*/
const sourceLocale = 'en';

/* Loads, if present, the CLI arguments for input and output filenames
   indicated by -i and -o, without extension
*/
var argv = require('minimist-lite')(process.argv.slice(2));
var inputFileName = argv.i || 'Localization';
var outputFileName = argv.o || 'strings';

/* Tries to load the Figma variables source file, in JSON format.
   The file should've been generated with the Figma plugin "Export/Import Variables"
   https://www.figma.com/community/plugin/1256972111705530093
*/
var figmaFile;
try {
    figmaFile = JSON.parse(fs.readFileSync('./' + inputFileName + '.json', 'utf8'));
    console.log('Figma file opened.');
} catch (err) {
    console.log('Error reading Figma file!');
    console.error(err);
    return;
}

/* Finds the defined sourceLocale's ID on the Figma file;
   Creates a new localesIds object to store the available locales
   in a better order, also with the original ID
*/
var localesIds = {};
for (const [key, value] of Object.entries(figmaFile.modes)) {
    localesIds[value] = key;
}
const idToLocale = Object.fromEntries(
    Object.entries(localesIds).map(([lang, id]) => [id, lang])
  );

/* Loops thru all the strings contained on the Figma file
   
*/
var translations = {};
figmaFile.variables.forEach(variable => {
  if (!variable.name.includes("(plural)")) {
    var id = formatNameId(variable.name);
    
    translations[id] = {};
    
    for (const [key, value] of Object.entries(variable.valuesByMode)) {
      const locale = idToLocale[key];
      // Garante que a chave existe
      if (!translations[id]) {
        translations[id] = {};
      }
      
      if (key === localesIds[sourceLocale]) {
        translations[id].source = value;
      } else if (locale) {
        translations[id][locale] = value;
      }
    }
  } else {
    var id = formatNameId(variable.name.replace(/\s*\(plural\)\s*$/, '').trim());
    
    if (translations.hasOwnProperty(id)) {
      translations[id].plural = {};
      for (const [key, value] of Object.entries(variable.valuesByMode)) {
        const locale = idToLocale[key];

        
        if (key === localesIds[sourceLocale]) {
          translations[id].plural.source = value;
        } else if (locale) {
          translations[id].plural[locale] = value;
        }
      }
    }
  }
});

for (const [key] of Object.entries(localesIds)) {
  if (key != sourceLocale) {
    saveXliffToFile(translations, key);
  }
}

function formatNameId(input) {
  const nameParts = input.split('/').slice(1); // ignora o primeiro
  
  const transformedParts = nameParts.map(part => {
    const cleaned = part
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove pontuação
    .replace(/\s+([a-z])/g, (_, c) => c.toUpperCase()) // camelCase palavras
    .replace(/\s+/g, '');            // remove quaisquer espaços restantes
    
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  });
  
  const finalName = transformedParts.join('_');
  
  return finalName;
}

function escapeXml(str) {
  if (typeof str !== 'string') {
    str = String(str ?? '');
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateXliff2(translations, targetLocale = 'pt_br') {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0">
  <file id="translations" original="generated" datatype="html">
`;
  
  for (const [id, entry] of Object.entries(translations)) {
    const hasPlural = entry.plural && entry.plural[targetLocale];
    
    const sourceText = hasPlural
    ? `{VAR_PLURAL, plural, =1 {${entry.source}} other {${entry.plural.source}} }`
    : entry.source;
    
    const targetText = hasPlural
    ? `{VAR_PLURAL, plural, =1 {${entry[targetLocale]}} other {${entry.plural[targetLocale]}} }`
    : entry[targetLocale];
    
    xml += `    <unit id="${id}" datatype="html">
      <segment>
        <source>${escapeXml(sourceText)}</source>
        <target>${escapeXml(targetText)}</target>
      </segment>
    </unit>
`;
  }
  
  xml += `  </file>
</xliff>`;
  
  return xml;
}

function saveXliffToFile(translations, targetLocale = 'pt_br', outputDir = './') {
  const xliffContent = generateXliff2(translations, targetLocale);
  const filename = path.join(outputDir, `translations_${targetLocale}.xlf`);

  fs.writeFileSync(filename, xliffContent, 'utf-8');
  console.log(`Translation file created at: ${filename}`);
}