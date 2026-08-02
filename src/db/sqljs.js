import initSqlJs from 'sql.js';
import { openDB } from 'idb';

let dbInstance = null;
let SQL = null;
const DB_NAME = 'abspielen_sqljs';
const STORE_NAME = 'sqlite_store';

async function getSqlJs() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/${file}`
    });
  }
  return SQL;
}

async function getIndexedDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    }
  });
}

async function saveDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const idb = await getIndexedDb();
  await idb.put(STORE_NAME, data, 'db_binary');
}

export const SqlJsPlugin = {
  createConnection: async () => {
    const SQL = await getSqlJs();
    const idb = await getIndexedDb();
    const data = await idb.get(STORE_NAME, 'db_binary');
    if (data) {
      dbInstance = new SQL.Database(data);
    } else {
      dbInstance = new SQL.Database();
    }
  },

  open: async () => {
    // Already opened in createConnection
  },

  execute: async ({ statements }) => {
    dbInstance.exec(statements);
    await saveDb();
    return { changes: { changes: 1 } };
  },

  run: async ({ statement, values }) => {
    dbInstance.run(statement, values);
    await saveDb();
    return { changes: { changes: 1 } };
  },

  query: async ({ statement, values }) => {
    const stmt = dbInstance.prepare(statement);
    stmt.bind(values);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return { values: rows };
  },

  executeSet: async ({ set }) => {
    dbInstance.exec('BEGIN TRANSACTION;');
    try {
      for (const item of set) {
        dbInstance.run(item.statement, item.values);
      }
      dbInstance.exec('COMMIT;');
      await saveDb();
    } catch (e) {
      dbInstance.exec('ROLLBACK;');
      throw e;
    }
    return { changes: { changes: 1 } };
  }
};
