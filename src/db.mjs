import fs from 'node:fs';
import crypto from 'node:crypto';
import sqlite from 'better-sqlite3';
import log4js from 'log4js';

const logger = log4js.getLogger();

const STATUS = {
    NEW: 0,
    OPENED: 1,
    from: function (num) {
        for (const key in STATUS) {
            if (STATUS[key] === num) {
                return key;
            }
        }
        return '';
    }
};

/**
 * @typedef {object} Message
 * @property {string} [id]
 * @property {string} from
 * @property {string} to
 * @property {string} subject
 * @property {string} body
 * @property {number} [sent]
 * @property {number} [exp]
 * @property {boolean} [opened]
 */

const WEEK_SEC = 60 * 60 * 24 * 7;

export const DB = new class {
    #db;
    
    constructor() {
        if (!fs.existsSync('database/')) {
            fs.mkdirSync('./database');
        }
        try {
            this.#db = new sqlite('database/db.sqlite');
            this.#db.exec('CREATE TABLE IF NOT EXISTS message(id TEXT PRIMARY KEY, sent_from TEXT, send_to TEXT, subject TEXT, body TEXT, sent INT, exp INT, status INT)');
        } catch (e) {
            logger.error(e);
            throw new Error('init DB');
        }
        setInterval(() => this.clean(), 10000);
    }

    /**
     * @param {Message} mes 
     * @returns {string}
     */
    register(mes) {
        const id = crypto.randomUUID();
        const sent = Math.floor(new Date().getTime() / 1000);
        const exp = mes.exp || (sent + WEEK_SEC);
        const record = {
            id,
            from: mes.from,
            to: mes.to,
            subject: mes.subject,
            body: mes.body,
            sent,
            exp,
            status: 0
        };
        const sql = 'INSERT INTO message VALUES(@id, @from, @to, @subject, @body, @sent, @exp, @status)';
        try {
        this.#db.prepare(sql).run(record);
        } catch (e) {
            logger.error('Cannot register message.');
            return '';
        }
        return id;
    }

    /**
     * 
     * @param {string} from 
     * @param {string} to
     * @returns {Message[]}
     */
    get(from, to) {
        const sql = 'SELECT * FROM message WHERE sent_from = ? AND send_to = ?';
        const records = this.#db.prepare(sql).all(from, to);
        const ret = [];
        for (const record of records) {
            ret.push({
                id: record.id,
                from: record.sent_from,
                to: record.send_to,
                subject: record.subject,
                body: record.body,
                sent: record.sent,
                exp: record.exp,
                opened: record.status === 1
            });
        }
        return ret;
    }

    /**
     * @param {string} id
     * @returns {boolean} 
     */
    setOpened(id) {
        const record = this.#db.prepare('SELECT * FROM message WHERE id = ?').get(id);
        if (!record) {
            return false;
        }
        const sql = `UPDATE message SET status = ${STATUS.OPENED} WHERE id = ?`;
        this.#db.prepare(sql).run(id);
        return true;
    }

    clean() {
        const sql = 'DELETE FROM message WHERE exp < ?';
        const now = Math.floor(new Date().getTime() / 1000);
        this.#db.prepare(sql).run(now);
    }
}();
