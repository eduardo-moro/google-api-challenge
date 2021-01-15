const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const spreadSheetId = '1dAjghC3B2xeZeTQ9k_cuGLDaCwXEPWhmviYz_axGwUE';

SCOPES = ['https://spreadsheets.google.com/feeds',
         'https://www.googleapis.com/auth/drive']

const TOKEN_PATH = 'credentials/token.json';

const totalClasses = 60;

fs.readFile('credentials/credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), getAllData);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}


function getAllData(auth) {
    global.sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
        spreadsheetId: spreadSheetId,
        range: 'A4:H',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
            fetchAproved(rows);
        } else {
            console.log('No data found.');
        }
    });
}

function fetchAproved(data) {
    let i = 4;
    data.map((row) => {
        let name = row[1];
        let missing = row[2];
        let p1 = parseFloat(row[3], 10);
        let p2 = parseFloat(row[4], 10);
        let p3 = parseFloat(row[5], 10);
        if(missing < (totalClasses / 4)) {
            if(getMeanGrade(p1, p2, p3) < 50) {
                updateCell(spreadSheetId, 'G'+i,"Reprovado por Nota");
            } else if(getMeanGrade(p1, p2, p3) < 70) {
                updateCell(spreadSheetId, 'G'+i,"Exame Final");
                updateCell(spreadSheetId, 'H'+i, getNeededGrade((p1 + p2 + p3) / 3));
            } else if(getMeanGrade(p1, p2, p3) >= 70){
                updateCell(spreadSheetId, 'G'+i,"Aprovado");
            }
        } else {
            updateCell(spreadSheetId, 'G'+i,"Reprovado por Falta");
        }
        i++;
    });
}

function getMeanGrade(p1, p2, p3) {
    return ((p1 + p2 + p3) / 3).toFixed(2);
}

function getNeededGrade(meanGrade) {
    let needed = 100 - meanGrade;
    return needed.toFixed(2);
}

function updateCell(spreadsheetId, range, value) {
    global.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: "USER_ENTERED",
        resource: {
            range: range,
            majorDimension: 'ROWS',
            values: [[value]]
        },
    }, (err, result) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log(range + ' updated successfully!');
        }
    });
}