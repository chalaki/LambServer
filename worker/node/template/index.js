exports.handler = async (event) => {
    var verbose = true;
    if (verbose) console.log("###############Inside Lambda handler - received event: ");
    if (verbose) console.log(event);
    var startTime = new Date().getTime();
    var responseJson = {};
    var needsArray = [];
    var responseCode = "200";
    try {
        responseJson.statusCode = "400"; // assume error..overwrite later
        if (event.queryStringParameters != null) if (event.queryStringParameters.need != null) needsArray = event.queryStringParameters.need.split('-');
        var responseBody = {};
        var stopTime = new Date().getTime();
        var elapsedTime = (stopTime - startTime) / 1000.0;
        responseBody.elapsed = elapsedTime;
        Array.apply(null, { length: 5 }).map(Function.call, Math.random).forEach(i => { responseBody[i] = i * i * i; });
        console.log('elapsed: ' + elapsedTime);
        responseJson.isBase64Encoded = false;
        responseJson.statusCode = responseCode;
        responseJson.headers = { "x-custom-header": "my custom header value" };
        responseJson.body = JSON.stringify(responseBody);
    }
    catch (ex) { console.log(ex.toString()); }
    console.log('status code: ' + responseJson.statusCode);
    return responseJson;
};