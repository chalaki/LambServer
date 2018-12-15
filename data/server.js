var http = require('http');
var index = require('./index');
var startTime;
var host;
var port = 8081;
var handleRequest = function (request, response) {
    response.setHeader('Content-Type', 'text/plain');
    response.writeHead(200);
    need = 'getsurveys';
    event = { queryStringParameters: { need: need, surveyId: 814412, supplierId: 1, supplierName: 'Mallesh', surveyName: 'Sattva', sdate: '2018-11-04', edate: '2018-11-08' } };
    var resultPromise = index.handler(event);
    var resp;
    resultPromise.then(function (result) {
        resp = JSON.stringify(result);
        response.write(result.body);
        response.end();
    }, function (err) {
        resp = JSON.stringify(err);
        response.write(resp);
        response.end();
    })
}
var www = http.createServer(handleRequest);
www.listen(port, async function () {
    startTime = new Date();;

    console.log("web App Started At:", startTime, "| Running On: ", port, "\n");
});