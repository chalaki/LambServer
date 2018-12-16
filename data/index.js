exports.handler = async (event) => {
                        var verbose = true;
                        if (verbose) console.log("############### Loading Lambda handler ############");
                    
                        
                    
                        var startTime = new Date().getTime();
                        var responseJson = {};
                        var needsArray = [];
                        var responseCode = "200";
                        try {
                            responseJson.statusCode = "400"; // assume error..overwrite later
                            if (verbose) console.log("Event received: ");
                            if (verbose) console.log(event);
                    
                            if (event.queryStringParameters != null) if (event.queryStringParameters.need != null) needsArray = event.queryStringParameters.need.split('-');
                            if (verbose) console.log("  Received event:" + JSON.stringify(event));
                    
                            var responseBody = {};
                            var stopTime = new Date().getTime();
                            var elapsedTime = (stopTime - startTime) / 1000.0;
                            responseBody.elapsed = elapsedTime;
                            console.log('elapsed: ' + elapsedTime);
                    
                            responseJson.isBase64Encoded = false;
                            responseJson.statusCode = responseCode;
                            responseJson.headers = { "x-custom-header": "my custom header value" };
                            responseJson.body = JSON.stringify(responseBody);
                        }
                        catch (pex) { console.log(pex.toString()); }
                        console.log('status code: ' + responseJson.statusCode);
                        return responseJson;
                    };