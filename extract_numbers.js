const fs = require('fs');
const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync('data.sqlite');
  const db = new SQL.Database(filebuffer);
  
  const numbers = new Set();

  const res = db.exec("SELECT DISTINCT phone_number FROM tag_assignments WHERE phone_number IS NOT NULL");
  if (res.length > 0) {
    res[0].values.forEach(v => numbers.add(v[0]));
  }
  
  const res2 = db.exec("SELECT DISTINCT phone_number FROM notes WHERE phone_number IS NOT NULL");
  if (res2.length > 0) {
    res2[0].values.forEach(v => numbers.add(v[0]));
  }
  
  console.log("Total unique numbers from sqlite:", numbers.size);
  numbers.forEach(n => console.log(n));
})();
