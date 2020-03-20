const errorReportHtml = (records) => {
    let html = '';
    let recordsHtml = records.map( error => {
        return `
        <tr>
            <td>${error.level}</td>
            <td>${error.message}</td>
            <td>${error.created_at}</td>
        </tr>
        `
    }).join('');

    html += `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
    <style>
    table {
      font-family: arial, sans-serif;
      border-collapse: collapse;
      width: 100%;
    }
    
    td, th {
      border: 1px solid #dddddd;
      text-align: left;
      padding: 8px;
      white-space: pre-line;
    }
    
    tr:nth-child(even) {
      background-color: #dddddd;
    }
    </style>
    </head>
    <body>
    
    <h2>Errors</h2>
    
    <table>
      <tr>
        <th>Level</th>
        <th>Message</th>
        <th>Time</th>
      </tr>
      ${recordsHtml}
    </table>
    </body>
    </html>`;

    return html;
}

module.exports = {
    errorReportHtml
};