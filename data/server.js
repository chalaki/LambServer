var http = require('http');
var index = require('./index');
var qs = require('querystring');
var startTime;
var host;
var port = 8081;
var handleRequest = function (request, response) {

    response.setHeader('Content-Type', 'text/plain');
    response.writeHead(200);
    //console.log("handleRequest\r\n");

    if (request.method == 'POST') {
        //console.log("POST\r\n");
        var body = '';
        request.on('data', function (data) {
            body += data;
            // Too much POST data, kill the connection! 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6) request.connection.destroy();
        });

        request.on('end', function () {
            var event = JSON.parse(body);
            console.log(body);
            console.log(event);
            var resultPromise = index.handler(event);
            var resp;
            resultPromise.then(function (result) {
                console.log("index.handler success\r\n");
                resp = JSON.stringify(result);
                response.write(result.body);
                response.end();
                endTime = new Date();
                console.log("web App POST ending At:", endTime);
            }, function (err) {
                console.log("index.handler failure\r\n");
                console.log(err);
                resp = JSON.stringify(err);
                response.write(resp);
                response.end();
            })
        });
    }
    else {
        console.log("GET\r\n");
        need = 'getsurveys';
        event = { queryStringParameters: { need: need, surveyId: 814412, supplierId: 1, supplierName: 'Mallesh', surveyName: 'Sattva', sdate: '2018-11-04', edate: '2018-11-08' } };
        var resultPromise = index.handler(event);
        var resp;
        resultPromise.then(function (result) {
            resp = JSON.stringify(result);
            response.write(result.body);
            response.end();
            console.log("web App GET ending At:", endTime);
        }, function (err) {
            resp = JSON.stringify(err);
            response.write(resp);
            response.end();
        })
    }
}
var www = http.createServer(handleRequest);
www.listen(port, async function () {
    startTime = new Date();;
    console.log("Worker Started At:", startTime, " Port: ", port, "\n");
});