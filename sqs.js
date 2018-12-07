var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });
var sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
var qurl = "https://sqs.us-west-2.amazonaws.com/727706852856/SupRep";
//var conString = "postgresql://postgres:SfApps123@localhost:5432/limesurvey29";
//var conString = "postgresql://postgres:SfApps123@vox.cig7k7sblhaw.ap-south-1.rds.amazonaws.com:5432/limesurvey29";
//var conString = "postgresql://postgres:SfApps123@vox.cmsddmg9z6s8.us-west-2.rds.amazonaws.com:5432/voxportal29";
var conString = "postgresql://postgres:SfApps123@vmicro.cmsddmg9z6s8.us-west-2.rds.amazonaws.com:5432/ls29";
var logger = console;

exports.handler = async (event) => {
    //var qname = "SupRep";
    //var params = { QueueName: qname };
    //await sqs.listQueues(params, function (err, data) { if (err) { console.log("listQueues() Error: ", err); } else { console.log("list queues: ", data); } });
    //await sqs.getQueueUrl(params, function (err, data) { if (err) { console.log("getQueueUrl Error: ", err); } else { console.log("get queue url: ", data.QueueUrl); } });

    var sendMessageParams = {
        DelaySeconds: 10,
        MessageAttributes: {},
        MessageBody: JSON.stringify({
            "UID": Math.floor((Math.random() * 100000) + 1), "AC": Math.floor((Math.random() * 120) + 1), "PB": Math.floor((Math.random() * 500) + 1), "TS": new Date().toISOString(),
            "A1": Math.floor((Math.random() * 20) + 1), "A2": Math.floor((Math.random() * 20) + 1)
        }),
        QueueUrl: qurl
    };
    await sqs.sendMessage(sendMessageParams, function (err, data) { if (err) console.log("sendMessage() Error: ", err); else console.log("sendMessage() Success: ", data.MessageId); });

    var receiveMessageParams = { AttributeNames: ["SentTimestamp"], MaxNumberOfMessages: 3, MessageAttributeNames: ["All"], QueueUrl: qurl, VisibilityTimeout: 10, WaitTimeSeconds: 0 };
    var sql = "";
    await sqs.receiveMessage(receiveMessageParams, async function (err, data) {
        if (err) { console.log("receiveMessage() Error: ", err); }
        else if (data.Messages) {
            console.log("receiveMessage() received messages " + data.Messages.length);
            //console.log(data);
            data.Messages.forEach(function (Message, index) {
                //console.log(Message.Body); //console.log(x.MessageAttributes);
                var body = JSON.parse(Message.Body);
                sql = "INSERT into aa_survey_results (userid, ac_id, pb_id, a1, a2, user_timestamp) values (" + body.UID + ", " + body.AC
                    + ", " + body.PB + ", " + body.A1 + ", " + body.A2 + ", '" + body.TS + "');\r\n";
                console.log("index: " + index + " " + sql);
                //console.log("receiveMessage() received: ", data);

                var delMsgParams = { QueueUrl: qurl, ReceiptHandle: Message.ReceiptHandle };
                DeleteMsgAppendFileInsertTbl(delMsgParams, sql);
            })
        }
    });
}
var InsertTblsFunc = async (query) => {
    try {
        const { Client } = require('pg');
        var client = new Client(conString);
        await client.connect();
        const res = await client.query(query);
        console.log("deleteMessage() inserted in tbl");
    }
    catch (e) { logger.log(e); }
    client.end();
};

var DeleteMsgAppendFileInsertTbl = (deleteMsgParams, sqlToWrite) => {
    sqs.deleteMessage(deleteMsgParams, function (err, data) {
        if (err) console.log("Delete Error", err);
        else {
            try {
                console.log("deleteMessage() Deleted message: ", data);
                var filename = 'survey-insert-' + new Date().toISOString().split(':')[0] + '.sql'
                const fs = require('fs'); fs.appendFile(filename, sqlToWrite, function (err) { if (err) throw err; });
                console.log("deleteMessage() appended file: ", filename);

                InsertTblsFunc(sqlToWrite);
            }
            catch (e) { logger.log(e); }
        }
    });
};

exports.handler();