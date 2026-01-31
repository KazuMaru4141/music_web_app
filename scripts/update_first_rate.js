const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[match[1].trim()] = value;
    }
});

const key = env['GOOGLE_PRIVATE_KEY'] || '';
const cleanedKey = key
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/"/g, '');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: env['GOOGLE_CLIENT_EMAIL'],
        private_key: cleanedKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = env['SHEET_ID_LIKED_SONGS'];
const SHEET_NAME = 'シート1';

async function run() {
    try {
        console.log("Connecting to Sheet...");

        // REPAIR: Force I1 to 'Rating' (Index 0 is Row 1)
        console.log("Repairing Header (I1) -> 'Rating'...");
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!I1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Rating']] },
        });

        // Update Row 2 (First Data Row) to 3
        console.log("Updating First Data Row (I2) -> '3'...");
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!I2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['3']] },
        });

        console.log("✅ Repair and Update Complete.");

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
