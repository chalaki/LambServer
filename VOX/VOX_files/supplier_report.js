var supplierReportTable;
var saab1;
var apiBaseUrl = 'https://cors.io/?https://sx4a1t4gqb.execute-api.us-west-2.amazonaws.com/prod?'
var suprepqry = 'need=suprep&surveyId=814412&surveyName=Sattva&sdate=2018-11-01&edate=2018-11-01&supplierId=1&supplierName=Mallesh';

// written by: Raj Sundarigari
$(document).ready(function () {

	getRawDataId();
	getSuppliersData();

	$('#downloadSupplierReport').click(function () {
		if ($.fn.dataTable.isDataTable('#supplierReportTable')) supplierReportTable.destroy();
		showSupplierReport();
	});

	$('#downloadElectionSupplierReport').click(function () {
		if ($.fn.dataTable.isDataTable('#electionReportTable')) supplierReportTable.destroy();
		showElectionReport();
	});

	$('#downloadSMSReport').click(function () {
		if ($.fn.dataTable.isDataTable('#electionReportTable')) supplierReportTable.destroy();
		showSMSReport();
	});

	//	$('#surveys').change(function() {
	//		// alert("Hello");
	//		var surveyId = $('#surveys').val();
	//		if (surveyId != 00) {
	//			$.ajax({
	//				url : './quotamgmt/getConstituencys.do',
	//				type : 'POST',
	//				data : {
	//					surveys : surveyId,
	//					sid : surveyId
	//				},
	//				dataType : 'json',
	//				success : function(result) {
	//					if (result.dataAvailable) {
	//						var surveysList1 = [ {
	//							id : "ALL",
	//							text : "ALL"
	//						} ];
	//						$.each(result.data, function(i, data) {
	//							surveysList1.push({
	//								id : data.acs,
	//								text : data.acs
	//							});
	//						});
	//					}
	//				}
	//			});
	//		}
	//	});

	$("#start_dateofreport").datepicker({
		dateFormat: "yy-mm-dd",
		yearRange: "-100:+0", // last hundred years
		changeMonth: true,
		changeYear: true,
		inline: true,
		excluded: false,
		altField: "#datep"
	});
	$("#end_dateofreport").datepicker({
		dateFormat: "yy-mm-dd",
		yearRange: "-100:+0", // last hundred years
		changeMonth: true,
		changeYear: true,
		inline: true,
		excluded: false,
		altField: "#datep"
	});

});

function getRawDataId() {
	$.ajax({
		url: apiBaseUrl + 'need=surveys',
		type: 'GET',
		dataType: 'json',
		success: function (result) {
			// console.log(result.data);
			var options = "<option value='selectOption'>select Any Survey</option>";
			var surveysList = [{
				id: "00",
				text: "1 Select Any Survey"
			}];
			$.each(result.surveys, function (i, data) {
				surveysList.push({
					id: data.surveyls_survey_id,
					text: data.surveyls_title
				});
			});
			$("#surveys").html('').select2({
				width: '100%',
				data: surveysList.sort(SortByName),
			});
			$("#esurveys").html('').select2({
				width: '100%',
				data: surveysList.sort(SortByName),
			});
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) { alert("Status: " + textStatus); alert("Error: " + errorThrown); }
	});
}

// get a list of suppliers
function getSuppliersData() {
	$.ajax({
		url: apiBaseUrl + 'need=suppliers',
		type: 'GET',
		dataType: 'json',
		success: function (result) {
			// console.log(result.data);
			var options = "<option value='selectOption'>select Any Supplier</option>";
			var supList = [{
				id: "00",
				text: "1 Select Any Supplier"
			}];
			$.each(result.suppliers, function (i, data) {
				supList.push({
					id: data.supplier_id,
					text: data.supplier_name
				});
			});
			$("#suppliers").html('').select2({
				width: '100%',
				data: supList.sort(SortByName),
			});
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) { alert("Status: " + textStatus); alert("Error: " + errorThrown); }
	});
}

// populate supplierReportTable datatable
function showSupplierReport() {
	var surveyName = $('#surveys  option:selected').text();
	var surveyId = $('#surveys').val();
	var startdateofreport = $('#start_dateofreport').val();
	var enddateofreport = $('#end_dateofreport').val();
	var supplierId = $('#suppliers').val();
	var supplierName = $('#suppliers  option:selected').text();

	if (surveyId != 00) {
		$.ajax({
			url: apiBaseUrl,// + suprepqry,
			type: 'GET',
			data: {
				need: 'suprep',
				surveyId: surveyId,
				surveyName: surveyName,
				sdate: startdateofreport,
				edate: enddateofreport,
				supplierId: supplierId,
				supplierName: supplierName
			},
			dataType: 'json',
			success: function (result) {
				$('#StatusDiv').html(result.supreport.status);
				//$('#supplierReportTable').html("");
				if (result.supreport.Data == "") {
					$('#supplierReportTable').hide();
					return;
				}
				$('#supplierReportTable').show();
				data = result.supreport.Data;
				//$('#supplierReportTable tbody > tr').remove();
				//$('#supplierReportTable thead > tr').remove();

				supplierReportTable = $('#supplierReportTable').DataTable({
					"data": data.DATA,
					"columns": data.COLUMNS,
					paging: false,
					searching: false,
					dom: 'frtipB',
					buttons: [{
						extend: 'excel',
						text: 'Download Report',
						title: 'Supplier_Report_' + surveyId,
						className: 'btn btn-info btn-sm col-sm-2 excelbtn',
						exportOptions: {
							modifier: {
								page: 'all'
							},
							stripHtml: true
						}
					},]
				});
				//$('#colmain').html(data[0].TITLE1);
			},
			error: function (XMLHttpRequest, textStatus, errorThrown) { alert("Status: " + textStatus); alert("Error: " + errorThrown); }
		});
	} else { alert("Please select the survey."); }
}

function SortByName(x, y) { return ((x.text == y.text) ? 0 : ((x.text > y.text) ? 1 : -1)); }