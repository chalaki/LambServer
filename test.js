var docker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
var docker_name = 'nodeworker' + docker_ext_port;
const { exec } = require('child_process');
exec('docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + docker_ext_port + ':8081/tcp  sundarigari/nodeimage:version3', (err, stdout, stderr) => {
    if (err) console.log(`error executing command`);
    console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
    exec('docker cp  c:/temp/. ' + docker_name + ':/', (err, stdout, stderr) => {
        if (err) console.log(`error executing command`);
        console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
        exec('docker exec -d ' + docker_name + ' bash server.sh', (err, stdout, stderr) => {
            if (err) console.log(`error executing command`);
            console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);

            let url = 'http://192.168.99.100:' + docker_ext_port + '/';
            const request = require('request');
            request(url, function (err, response, body) {
                if (err) {
                    //res.render('index', { weather: null, error: 'Error, please try again' });
                } else {
                    // let weather = JSON.parse(body)
                    // if (weather.main == undefined) {
                    //     res.render('index', { weather: null, error: 'Error, please try again' });
                    // } else {
                    let weatherText = body;//`It's ${weather.main.temp} degrees in ${weather.name}!`;
                    console.log(body);
                    //res.render('index', { weather: weatherText, error: null });
                    // }
                }
                exec('docker cp ' + docker_name + ':/worker.log  c:/temp/' + docker_name + '.log', (err, stdout, stderr) => {
                    const fs = require('fs');
                    fs.readFile('c:/temp/' + docker_name + '.log', "utf8", function (err, data) {
                        if (err) throw err;
                        console.log(data);
                    });

                    console.log(body);
                    exec('docker stop ' + docker_name, (err, stdout, stderr) => {
                        if (err) console.log(`error executing command`);
                        console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
                        exec('docker rm ' + docker_name, (err, stdout, stderr) => {
                            if (err) console.log(`error executing command`);
                            console.log(`stdout: ${stdout}`); console.log(`stderr: ${stderr}`);
                        });
                    });
                });
            });

        });
    });
});