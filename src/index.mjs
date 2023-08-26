import { env } from 'node:process';
import log4js from 'log4js';
import express from 'express';
import { DB } from './db.mjs';

log4js.configure('conf/logconfig.json');
const logger = log4js.getLogger();

const app = express();
app.use(express.json());
const port = parseInt(env['PORT'] ?? '3800');
app.listen(port, () => logger.info('Listening to port ' + port));

app.get('/messages/:from/:to', (req, res) => {
    const from = req.params.from;
    const to = req.params.to;

    res.json({
        messages: DB.get(from, to)
    });
});

app.post('/message/:from/:to', (req, res) => {
    const from = req.params.from;
    const to = req.params.to;

    if (!req.body) {
        res.status(400).end();
        return;
    }

    const mes = {
        ...req.body,
        from,
        to
    };
    if (!validate(mes)) {
        res.status(400).end();
        return;
    }

    const id = DB.register(mes);
    if (!id) {
        res.status(500).end();
        return;
    }
    res.json({
        id
    });
});

app.patch('/message/:id/open', (req, res) => {
    const id = req.params.id;
    const opened = DB.setOpened(id);
    if (!opened) {
        res.status(404).end();
    }
    res.end();
});

/**
 * @param {object} mes 
 * @returns {boolean}
 */
function validate(mes) {
    return mes?.from && (typeof mes.from === 'string')
        && mes?.to && (typeof mes.to === 'string')
        && mes?.subject && (typeof mes.subject === 'string')
        && mes?.body && (typeof mes.body === 'string');
}
