const fs = require('fs');
const path = require('path');

function findNumbers(dir, numbers) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findNumbers(fullPath, numbers);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Match numbers like 1234567890@c.us or 1234567890@s.whatsapp.net
        const matches = content.match(/\b\d{10,15}@(c\.us|s\.whatsapp\.net)\b/g);
        if (matches) {
          matches.forEach(m => numbers.add(m.split('@')[0]));
        }
        
        // Also match raw numbers that look like whatsapp numbers if they are near chat keywords
        // For simplicity, just matching the explicit ones
      } catch (e) {
        // Ignore read errors
      }
    }
  }
}

const numbers = new Set();
findNumbers('.wwebjs_auth', numbers);

console.log("Total unique numbers from wwebjs_auth:", numbers.size);
numbers.forEach(n => console.log(n));

// Combine and write to CSV
const sqliteNumbers = [
  "245612100460796",
  "0",
  "280762700013690",
  "191461136044104",
  "176231702106348",
  "129068448088305"
];
sqliteNumbers.forEach(n => {
  if (n !== "0") numbers.add(n);
});

let csv = "Phone Number\n";
numbers.forEach(n => {
  if (n && n.length > 5) csv += n + "\n";
});

fs.writeFileSync('extracted_numbers.csv', csv);
console.log("Wrote to extracted_numbers.csv");
