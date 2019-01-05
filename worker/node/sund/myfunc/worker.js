var http = require('http');
var index = require('./index');
var startTime;
var port = 81;

var fs = require('fs');
var worker_env = JSON.parse(fs.readFileSync('./worker.config', 'utf8'));
var verbose = true;

var winston = require('winston');
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.label({ label: 'lambserver' }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        // The simple format outputs
        // `${level}: ${message} ${[Object with everything else]}`
        //format.simple()
        winston.format.printf(x => `${x.timestamp} ${x.level}: ${x.message}`)
    ),
    transports: [new winston.transports.Console()]
});

var handleRequest = function (request, response) {

    response.setHeader('Content-Type', 'text/plain');
    response.writeHead(200);
    if (verbose) logger.info("handleRequest called");
    const fs = require('fs');
    fs.writeFileSync('./worker.log', '');

    if (request.method == 'POST') {
        if (verbose) logger.info("worker POST received at: " + new Date().toString());
        var startTime = new Date().getTime();
        var body = '';
        request.on('data', function (data) {
            body += data;
            // Too much POST data, kill the connection! 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6) request.connection.destroy();
        });

        request.on('end', function () {
            var event = JSON.parse(body);
            if (verbose) logger.info("calling index.handler");
            var resultPromise = index.handler(event);
            var resp;
            resultPromise.then(function (result) {
                if (verbose) logger.info("index.handler success");
                var stopTime = new Date().getTime();
                var elapsedTime = (stopTime - startTime) / 1000.0;
                result.elapsedWorkerTime = elapsedTime;

                resp = JSON.stringify(result);

                if (result.body) response.write(result.body);
                else response.write(resp);
                response.end();
                if (verbose) logger.info("worker POST ending At:" + new Date().toString() + ' elapsed: ' + elapsedTime);
            }, function (err) {
                logger.error("index.handler() failure");
                logger.error(err);
                resp = JSON.stringify(err);
                response.write(resp);
                response.end();
            })
        });
    }
    else {
        if (verbose) logger.info("worker GET received at: " + new Date().toString());
        need = 'getsurveys';
        event = { queryStringParameters: { need: need, surveyId: 814412, supplierId: 1, supplierName: 'Mallesh', surveyName: 'Sattva', sdate: '2018-11-04', edate: '2018-11-08' } };
        if (verbose) logger.info("calling index.handler");
        var resultPromise = index.handler(event);
        var resp;
        resultPromise.then(function (result) {
            resp = JSON.stringify(result);
            if (result.body) response.write(result.body);
            else response.write(resp);
            response.end();
            if (verbose) logger.info("worker GET ending at: " + endTime);
        }, function (err) {
            resp = JSON.stringify(err);
            if (verbose) logger.error("index.handler() failure: " + JSON.stringify(err));
            response.write(resp);
            response.end();
        })
    }
}
var www = http.createServer(handleRequest);
www.listen(port, async function () {
    startTime = new Date().toLocaleString();
    var redis = require('redis');
    var redis_port = 6379;
    var redis_dns = '192.168.99.100';
    var worker_dns = redis_dns;

    if (verbose) logger.info("Worker Started at: ", startTime, " port: ", port, JSON.stringify(worker_env));
});