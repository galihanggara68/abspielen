import initSqlJs from 'sql.js';

/**
 * Creates a mock CapacitorSQLite plugin backed by sql.js for testing.
 * Mimics the Capacitor SQLite plugin API shape.
 */
export async function createMockPlugin() {
  const SQL = await initSqlJs();
  let db = null;

  return {
    async createConnection() {
      db = new SQL.Database();
    },

    async open() {},

    async execute({ statements }) {
      db.run(statements);
      return { changes: { changes: 0, lastId: 0 } };
    },

    async run({ statement, values }) {
      db.run(statement, values || []);
      const lastId = db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] || 0;
      return { changes: { changes: db.getRowsModified(), lastId } };
    },

    async query({ statement, values }) {
      const result = db.exec(statement, values || []);
      if (!result.length) return { values: [] };
      const cols = result[0].columns;
      const rows = result[0].values.map(row => {
        const obj = {};
        cols.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
      return { values: rows };
    },

    async executeSet({ set }) {
      for (const s of set) {
        db.run(s.statement, s.values || []);
      }
      return { changes: { changes: 0, lastId: 0 } };
    },

    close() {
      if (db) db.close();
      db = null;
    }
  };
}
