export const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // DATE kolone ostaju "YYYY-MM-DD", bez pomjeranja dana zbog vremenske zone
  dateStrings: true,
  // DECIMAL kolone dolaze kao brojevi, a ne kao tekst
  decimalNumbers: true,
};
