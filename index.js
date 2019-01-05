var logger = console;
var verbose = false;
var postgres_dns = '104.154.26.17'; //'35.226.248.125';
var postgres_port = 5432; //30432;
var conString = 'postgresql://postgres:SfApps123@' + postgres_dns + ':' + postgres_port.toString() + '/postgres';  // docker
const { Client } = require('pg');
var client;
exports.handler = async (event) => {
    if (verbose) logger.log("Lambda handler - received event: ");
    if (verbose) logger.log(JSON.stringify(event));

    client = new Client(conString);
    await client.connect();

    var startTime = new Date().getTime();
    var responseJson = {};
    var needsArray = [];
    var responseCode = "200";
    try {
        responseJson.statusCode = "400"; // assume error..overwrite later
        if (event.queryStringParameters != null) if (event.queryStringParameters.need != null) needsArray = event.queryStringParameters.need.split('-');
        var responseBody = {};

        if (needsArray.includes('surveys')) responseBody.surveys = await getRawDataId();
        if (needsArray.includes('suprep')) responseBody.supreport = await getSuppliersReport(event.queryStringParameters);
        if (needsArray.includes('suppliers')) responseBody.suppliers = await getSuppliersData();
        if (needsArray.includes('putsurvey')) responseBody.putsurvey = await insertSurvey(event.queryStringParameters);
        if (needsArray.includes('getsurveys')) responseBody.getsurveys = await getSurveys();
        var stopTime = new Date().getTime();
        var elapsedTime = (stopTime - startTime) / 1000.0;
        responseBody.elapsed = elapsedTime;
        logger.log('elapsed: ' + elapsedTime);

        responseJson.isBase64Encoded = false;
        responseJson.statusCode = responseCode;
        responseJson.headers = { "x-custom-header": "my custom header value" };
        responseJson.body = JSON.stringify(responseBody);
    }
    catch (pex) { logger.log(pex.toString()); }
    await client.end();
    logger.log('status code: ' + responseJson.statusCode);
    return responseJson;
};

const getRawDataId = async function () {

    var arr = [];
    try {
        var activeSurveys = [];
        activeSurveys = await getActiveSurveyIds();
        var query = "Select surveyls_survey_id, surveyls_title from lime_surveys_languagesettings ";
        const res = await client.query(query);
        res.rows.forEach(function myFunction(rowObj, index, array) { if (rowObj.surveyls_survey_id != '' && activeSurveys.includes(rowObj.surveyls_survey_id)) arr.push(rowObj); });
        if (verbose) logger.log("getRawDataId: " + JSON.stringify(arr));
    }
    catch (e) { logger.log("getRawDataId: " + JSON.stringify(e)); }
    return arr;
};

const getSuppliersData = async function () {

    if (verbose) logger.log("getSuppliersData():");
    var arr = [];
    try {
        var suppliersQuery = "Select distinct supplier_id, supplier_name from da_supplier_details ";
        if (verbose) logger.log("suppliersQuery:" + suppliersQuery);
        const result = await client.query(suppliersQuery);
        result.rows.forEach(function (rowObj) { arr.push(rowObj); });
    }
    catch (e) { logger.log(e); }
    return arr;
};

const getSuppliersReport = async function (qsp) {

    if (verbose) logger.log("getSupplierReport(): " + JSON.stringify(qsp));
    var colName = await getColumnName("AC", qsp.surveyId);
    var returnJSONObj = {}; // final response {}
    var arrayOfColumns = [];
    var arrayOfRows = [];
    var supRepTable = {};
    var condition2 = "";
    try {
        returnJSONObj.Status = "Failure"; // assume failure later overwrite
        arrayOfColumns = [];

        arrayOfRows = [];
        supRepTable = {};
        var sdate = new Date(qsp.sdate); //new SimpleDateFormat("yyyy-MM-dd").parse(_sdate);
        var edate = new Date(qsp.edate);//new SimpleDateFormat("yyyy-MM-dd").parse(_edate);
        var Started_Count = "0", Achieved_Count = "0", Target_Count = "0", Pending_Count = "0", Active_HUser_Count = "0", Total_Surveys_Done = "0";

        for (var dt = sdate; dt <= edate;) {

            var strDate = dt.toISOString().split('T')[0];
            if (strDate != null && strDate.trim().length != 0)
                condition2 = " and ls.submitdate::date <= date '" + strDate + "' ";

            var Started_AC_Count_query = "select count(*) from (select distinct split_part(ls.\"" + colName
                + "\", '_', 2) from lime_survey_" + qsp.surveyId + " ls, da_supplier_details sd "
                + " where ls.hybrid_userid= sd.h_uid and sd.supplier_id=" + qsp.supplierId + condition2
                + " and ls.\"" + colName + "\" like '%\\_%' " + " and split_part(ls.\"" + colName
                + "\", '_', 2) ~ E'^\\\\d+$' " // Postgresql ~ pattern matching operator to make sure its
                // integer
                + " ) as foo";

            var Target_AC_Count_query = "select   count (distinct acid), supplier_id, supplier_name  from da_supplier_details where supplier_id="
                + qsp.supplierId + " group by supplier_id, supplier_name";
            var Achieved_AC_Count_query = "SELECT supplier_id, sum(TotalQuotaInAC) as TotalQuota, sum(achieved_status) as Achieved_ACs from "
                + "(select *, case when TotalQuotaInAC - FinishedSurveys > 0 then 0   else  1 end as achieved_status  from  "

                + "(select sd.supplier_id, sd.acid,  sum(pb.quota) as TotalQuotaInAC  " + " from "
                + "(select distinct ac_id_09, booth_id_14, quota  from stl_polling_booth)  pb " + "INNER JOIN "
                + "(select distinct supplier_id, acid from da_supplier_details)  sd "
                + "ON pb.ac_id_09= sd.acid  and sd.supplier_id=" + qsp.supplierId + " "
                + " group by sd.acid, sd.supplier_id) sup_ac_totqota, "

                + "(select  supplier_id as supid, split_part(ls.\"" + colName + "\", '_', 1) AS ACName, "
                + "   CAST (split_part(ls.\"" + colName + "\", '_', 2) AS INTEGER) AS acid,       "
                + "   count(ls.\"" + colName + "\") as FinishedSurveys from lime_survey_" + qsp.surveyId
                + " ls, da_supplier_details sd " + "where ls.hybrid_userid= sd.h_uid and sd.supplier_id="
                + qsp.supplierId + " " + "and ls.\"" + colName + "\" like '%\\_%' " + "and split_part(ls.\""
                + colName + "\", '_', 2) ~ E'^\\\\d+$' " // Postgresql ~ pattern matching operator to make sure
                // its integer
                + condition2 + "GROUP BY ls.\"" + colName + "\", sd.supplier_id) sup_ac_finished_surveys "
                + "WHERE sup_ac_totqota.acid = sup_ac_finished_surveys.acid and supplier_id = supid  "
                + "ORDER BY sup_ac_totqota.supplier_id, sup_ac_totqota.acid)  combined_data "
                + "GROUP BY supplier_id";

            var ActiveHybridUsersCountQuery = "select count (distinct (h_uid))  from da_supplier_details sd, lime_survey_"
                + qsp.surveyId + " ls  " + "where ls.hybrid_userid= sd.h_uid and sd.supplier_id=" + qsp.supplierId
                + condition2;

            var TotalSurveysDoneQuery = "select count(*)  from da_supplier_details sd, lime_survey_" + qsp.surveyId
                + " ls,  stl_anonymous_user_survey aus "
                + "where ls.hybrid_userid= sd.h_uid AND ls.userid = aus.userid and aus.sid=" + qsp.surveyId
                + " and aus.cf='Y' AND sd.supplier_id=" + qsp.supplierId + condition2;

            var row_obj = [];
            try {
                row_obj.push(strDate);

                if (verbose) logger.log("Target_AC_Count_query: " + Target_AC_Count_query);
                var result = await client.query(Target_AC_Count_query);
                result.rows.forEach(function (rs2) {
                    Target_Count = rs2.count;
                    if (verbose) logger.log("Target_Count: " + Target_Count);
                    row_obj.push(Target_Count);
                });

                if (verbose) logger.log("Started_AC_Count_query: " + Started_AC_Count_query);
                const result2 = await client.query(Started_AC_Count_query);

                result2.rows.forEach(function (rs1) {
                    Started_Count = rs1.count;
                    if (verbose) logger.log("Started_Count: " + Started_Count);
                    row_obj.push(Started_Count);
                });

                if (verbose) logger.log("Achieved_AC_Count_query: " + Achieved_AC_Count_query);
                var _Achieved_Count = "0";
                var TotalQuota = "0";
                const result3 = await client.query(Achieved_AC_Count_query);
                if (result3.rows.length > 0) {
                    var rs3 = result3.rows[0];
                    _Achieved_Count = rs3.achieved_acs;
                    TotalQuota = rs3.totalquota;
                }
                else _Achieved_Count = "0";

                var diff = parseInt(Achieved_Count, 10) - parseInt(_Achieved_Count, 10);
                Achieved_Count = _Achieved_Count;

                if (verbose) logger.log("Achieved_Count, TotalQuota: " + Achieved_Count + "   " + TotalQuota);
                row_obj.push(Achieved_Count);

                Pending_Count = (parseInt(Target_Count, 10) - parseInt(Achieved_Count, 10)).toString();
                if (verbose) logger.log("Pending_Count: " + Pending_Count);
                row_obj.push(Pending_Count);

                if (verbose) logger.log("ActiveHybridUsersCountQuery: " + ActiveHybridUsersCountQuery);

                var _Active_HUser_Count = "0"; // current value
                const result4 = await client.query(ActiveHybridUsersCountQuery);
                result4.rows.forEach(function (rs4) { _Active_HUser_Count = rs4.count; });

                if (verbose) logger.log("Active_HUser_Count: " + _Active_HUser_Count);
                row_obj.push(_Active_HUser_Count);
                diff = parseInt(_Active_HUser_Count, 10) - parseInt(Active_HUser_Count, 10);
                Active_HUser_Count = _Active_HUser_Count;
                if (dt == sdate) row_obj.push("N/A");
                else row_obj.push(diff);
                if (verbose) logger.log("TotalSurveysDoneQuery: " + TotalSurveysDoneQuery);

                var _Total_Surveys_Done = "0"; // current value

                const result5 = await client.query(TotalSurveysDoneQuery);
                result5.rows.forEach(function (rs5) { _Total_Surveys_Done = rs5.count; });

                if (verbose) logger.log("Total_Surveys_Done: " + _Total_Surveys_Done);
                row_obj.push(TotalQuota);
                row_obj.push(_Total_Surveys_Done);
                diff = parseInt(_Total_Surveys_Done, 10) - parseInt(Total_Surveys_Done, 10);
                Total_Surveys_Done = _Total_Surveys_Done;
                if (dt == sdate) row_obj.push("N/A");
                else row_obj.push(diff);
                arrayOfRows.push(row_obj);
            }
            catch (e) { logger.log(e); }
            dt.setDate(dt.getDate() + 1);
        } // for loop

        [qsp.supplierName + " (" + qsp.surveyName + ") " + qsp.sdate + " to " + qsp.edate + " at: " + (new Date()).toDateString(),
            "Target AC Count", "Started AC Count", "Achieved AC Count", "Pending AC Count", "Active Hybrid Users", "Daily New Users",
            "Tot. Quota", "Tot. Surveys Done", "New Surveys"].forEach(x => arrayOfColumns.push({ title: x }));
        supRepTable.COLUMNS = arrayOfColumns;
        supRepTable.DATA = arrayOfRows;
        returnJSONObj.Data = supRepTable;
        returnJSONObj.Status = "Success";
    } catch (e) { logger.log("Exception: " + e); }
    if (verbose) logger.log("supRepTable: " + JSON.stringify(returnJSONObj));
    return returnJSONObj;
};

const getColumnName = async function (tip, surveyId) {
    if (!verbose) logger.log("getColumnName(" + tip + ", " + surveyId + ")");
    var getColumnNameQuery = "", retval = "";
    try {
        getColumnNameQuery = "Select concat(lq.sid,'X',lq.gid,'X',lq.qid) as columnname "
            + "from lime_questions lq Inner join lime_question_attributes lqa on lqa.qid=lq.qid and lqa.value='"
            + tip + "' where lq.sid='" + surveyId + "'";
        if (verbose) logger.log("getColumnNameQuery: " + getColumnNameQuery);
        const result = await client.query(getColumnNameQuery);
        retval = result.rows[0].columnname;
        if (verbose) logger.log("getColumnName(): " + retval);
    }
    catch (e) { logger.log("getColumnName Exception: " + JSON.stringify(e)); }
    return retval;
};

const getActiveSurveyIds = async function () { // returns []
    var listOfSurveys = [];
    try {
        var getActiveSurveyIdsQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name like 'lime_survey_%'";
        if (verbose) logger.log("getActiveSurveyIdsQuery: " + getActiveSurveyIdsQuery);

        const result = await client.query(getActiveSurveyIdsQuery);
        result.rows.forEach(function myFunction(rowObj, index, array) {
            var tableName = rowObj.table_name;
            var s = tableName.split("_");
            if (s.length == 3 && /^\+?(0|[1-9]\d*)$/.test(s[[2]])) listOfSurveys.push(parseInt(s[2], 10));
            // &&  !s[2].replaceAll("^$"," ").matches("[^\\d\\.]")) // see if it has only two _ and last word is integer
        });
    }
    catch (e) { logger.log("getActiveSurveyIds Exception: " + JSON.stringify(e)); }
    { logger.log("getActiveSurveyIds: " + JSON.stringify(listOfSurveys)); }
    return listOfSurveys;
};

const insertSurvey = async function (body) { // returns []
    console.log("insertSurvey(): " + JSON.stringify(body));
    var sql = "INSERT into aa_survey_results (userid, ac_id, pb_id, a1, a2, user_timestamp) values (" + body.uid + ", " + body.ac
        + ", " + body.pb + ", " + body.a1 + ", " + body.a2 + ", '" + body.ts + "');\r\n";
    console.log("sql: " + sql);
    var res;
    try {
        const { Client } = require('pg');
        var client = new Client(conString);
        await client.connect();
        res = await client.query(sql);
        console.log("inserted in tbl");
        return sql;
    }
    catch (e) { logger.log(e); }
    client.end();
    return { name: res };
};

const getSurveys = async function () { // returns []
    var getSurveysSql = "select id, userid as uid, pb_id as pb, ac_id as ac, a1, a2, user_timestamp as ts  from aa_survey_results";
    if (verbose) console.log("getSurveysSql: " + getSurveysSql);
    var res;
    try {
        const { Client } = require('pg');
        var client = new Client(conString);
        await client.connect();
        res = await client.query(getSurveysSql);
        //if (verbose) console.log("getSurveys" + JSON.stringify(res));
    }
    catch (e) { logger.log(e); }
    client.end();
    return res.rows;
};