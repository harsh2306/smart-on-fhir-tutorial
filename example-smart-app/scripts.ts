// All necessary imports

import { basicSetup, EditorState, EditorView} from '@codemirror/basic-setup';
import {keymap} from "@codemirror/view"
import {indentWithTab} from "@codemirror/commands"
import {autocompletion, CompletionContext} from "@codemirror/autocomplete"
import {StateField, EditorSelection} from "@codemirror/state"
import {Tooltip, showTooltip} from "@codemirror/tooltip"
import {indentUnit} from '@codemirror/language'

import axios from 'axios';
const headers = { 
	'Access-Control-Allow-Origin': '*',
	"Access-Control-Allow-Methods":"DELETE, POST, GET, OPTIONS"
}

// Initialization

const apiUrl = 'https://api.mi1.ai/api/'
const apiUrl_Dev = 'http://127.0.0.1:5000/'
var dataJson = []
var isLineChanged = false;
var isLineChangeNum = 1;
var check_order_for_order = false
let parent_problem
let orderOnClick=false
let current_state: EditorState
let current_line = 1
var currentPosition = 0
var currentRowText = ''
var currentLineFrom = 0
var currentLineTo = 0
var arrCUIs = []
var searchOptions = []
var lastFetchedCUI = ''
var isCheckingOrder = false
var suggestions = document.getElementById('suggestions-content')

// for Cerner clinical write testing only 
var encounterReference = '97954261'
var practitionerReference = '12743472'
// Theme Customization



let myTheme = EditorView.theme({
  "cm-editor": {
    fontSize: "24px",
    width: "100%",
    minHeight: "600px",
    outline: 0,
    border: 0,
    fontFamily: 'Poppins'
  },
  ".cm-content": {
  	fontSize: "24px"
  },
  ".cm-activeLine": {
  	backgroundColor: "initial",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-tooltip.cm-tooltip-cursor": {
   // display: "none"
  },
  ".cm-scroller": {
    minHeight: "600px"
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
  	lineHeight: 1.8
  },
  ".cm-tooltip": {
  	fontSize: "24px",
  	fontFamily: 'Poppins'
  },
  ".cm-lineWrapping": {
      // wordBreak: "break-all",
  }
}, {dark: false})


// get patient id and mi1 id from url 
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let PatientId= urlParams.get('Patientid')
let MI1_Client_ID= urlParams.get('MI1ClientID')


// generate id 
// let MI1_Client_ID = 123456789
// let PatientId = "eq081-VQEgP8drUUqCWzHfw3"
const fhirBody = {
		"PatientId": PatientId, 
		"MI1ClientID": MI1_Client_ID
}

const fhirConditionReadBody = {
	"patientId": PatientId, 
	"MI1ClientID": MI1_Client_ID
}
const fhirConditionsBody = {
	"patientId": PatientId, 
	"category": "problem-list-item",
	"clinical_status": "active",
	"MI1ClientID": MI1_Client_ID,
}


// get current time in epoch format
const secondsSinceEpoch = Math.round(Date.now() / 1000)

// get current data in dd/mm/yy format
// let dateObject = new Date()
// let currentDate = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear()

dataJson.push({
	"PatientId": PatientId,
	"Order-Date": secondsSinceEpoch,
	"Problems":[]
})

// local fhir api call to get patients data 
axios.post(apiUrl_Dev+"PatientData", fhirBody)
	.then((response)=>{
		let dob = response.data[0].DOB
		let mrn = response.data[0].MRN
		let name = response.data[0].Name
		let fhirHTMl =  document.getElementById("fhir")
		var fhirHTMl_div =''
		fhirHTMl_div+= '<div class="fhir-header"><h4>'
		fhirHTMl_div+= 'Patient Name : '+name+'</h4>'
		fhirHTMl_div+= '<h4> Medical Record Number (MRN): '+mrn+'</h4>'
		fhirHTMl_div+= '<h4> Date Of Birth : '+dob+'</h4>'
		fhirHTMl.innerHTML = fhirHTMl_div
	})

// local fhir api call to get patients condition
// setTimeout(() => { 
// 	a	console.log(response.data)
// 		})xios.post(apiUrl_Dev+"PatientConditions",fhirConditionsBody,{headers})
// 		.then((response)=>{
		
// 	}, 5000);

// axios.post(apiUrl_Dev+"PatientConditions",fhirConditionsBody,{headers})
// 		.then((response)=>{
// 			console.log(response.data)
// 		})


// Completion list function
// This function determines when should the autocomplete process begin

function myCompletions(context: CompletionContext) {

	// Does not give autocompletion after two spaces 
	// if( (currentRowText.length > 0 && currentRowText[0] == ' ') || (currentRowText.length < 3 || currentRowText.split(" ").length>2)){
		
	if( (currentRowText.length > 0 && currentRowText[0] == ' ') || (currentRowText.length < 3)){
  	searchOptions = []
  }

	let word = context.matchBefore(/\w*/)

	if (word.from == word.to && !context.explicit)
		return null
	if(currentRowText.startsWith('\t')){
		return {
			from: currentLineFrom+1,
			to: currentLineTo,
			options: searchOptions
		}
	}
	return {
		from: currentLineFrom,
		to: currentLineTo,
		options: searchOptions
	}

}

// Follow cursor movement while typing and when changing by mouse click

const cursorTooltipField = StateField.define<readonly Tooltip[]>({
  create: getCursorTooltips,

  update(tooltips, tr) {
      if (!tr.docChanged && !tr.selection) return tooltips
      return getCursorTooltips(tr.state)
    },

  provide: f => showTooltip.computeN([f], state => state.field(f))
})

function cursorTooltip() {
	return [cursorTooltipField]
}

// Fetch auto completion results from the API

async function fetchAutoComplete(startsWith){

	const body = {
		"startsWith":
		[
			{
				"startsWith": startsWith
			}
		]
	}

	await axios.post(apiUrl+'autocompleteProblems', body, {headers})
		.then(function (response) {		    
			
			if (response.data.length > 0){
				searchOptions = []	
			}

			for (var i=0; i <= response.data.length -1; i++){
				    
				let info = response.data[i].Known_CUI
				let label = response.data[i].Known_Problem

				searchOptions.push({
					info: info,
					label: label,
					apply: ()=>{
						let test = dataJson[0].Problems.filter(item=>{
							if(item.ProblemText==label){
								return item
							}
						})
						if(test.length==0){
							dataJson[0].Problems.push({
								"ProblemText": label,
								"ProblemCUI": info,
								"Orders":[],
							})
						}
						arrCUIs.push({
							type: 'problem',
							cui: info,
							name: label
						})
						view.dispatch({
							changes: {from: currentLineFrom, to: currentLineTo, insert: label}
						})
						let setCursor = EditorSelection.cursor(currentPosition)
						view.dispatch(
			        		view.state.update({
			            // selection: new EditorSelection([EditorSelection.cursor(currentPosition)], 0)
								selection: setCursor
			        		})
			      		)	
					}
				})
			
			}

		}).catch(function (error) { console.log(error) }).then(function () { })

}

// autocompleteOrders api
async function fetchAutoCompleteOrders(startsWith){

	const body = {
		"startsWith":
		[
			{
				"startsWith": startsWith
			}
		]
	}

	await axios.post(apiUrl+'autocompleteOrders', body, {headers})
		.then(function (response) {	
			if (response.data.length > 0){
				searchOptions = []	
			}
			searchOptions = []
			for (var i=0; i <= response.data.length -1; i++){
				    
				let info = response.data[i].Known_CUI
				let label = response.data[i].Known_Order
				
				searchOptions.push({
					info: info,
					label: label,
					apply: ()=>{
						dataJson[0].Problems.filter(i=>{
							if(i.ProblemText==parent_problem){
								i.Orders.push({
									"OrderCUI": info,
									"OrderText": label,
								})
							}
						})
						arrCUIs.push({
							type: 'order',
							ordercui: info,
							name: label
						})	
						view.dispatch({
							changes: {from: currentLineFrom, to: currentLineTo, insert: "\t"+label}
						})
						let contentLength = currentLineFrom+label.length+1	
						let setCursor = EditorSelection.cursor(contentLength)				
						view.dispatch(
			        view.state.update({
			            // selection: new EditorSelection([EditorSelection.cursor(contentLength)], 0)
						selection: setCursor
			        })
			      )	
					}
				})
			
			}

		}).catch(function (error) { console.log(error) }).then(function () { })

}

// Fetch problem results from the API

async function fetchProblems(CUI){
        	
	var cuis = []

	cuis.push({
		CUI: CUI
	})

	var cuisBody = {
  	"CUIs": cuis
  }

  document.getElementById('preloader').style.display = 'inline-flex'
  document.getElementById('particles-js').style.display = 'none'
	suggestions.innerHTML = ''
	await axios.post(apiUrl+'PotentialComorbidities', cuisBody, {headers})
		.then(function (response) {
			if(response.data.length === 0) {
				// suggestions.innerHTML = '<div><h3>No Data for problems:</h3></div>'	
				document.getElementById("defaultOpen").click();
				document.getElementById("problem_tab").style.display = 'block';
				document.getElementById("suggestions-content").style.display = 'none';
				document.getElementById("orders_tab").style.display = 'none';
				document.getElementById('preloader').style.display = 'none'
				document.getElementById('particles-js').style.display = 'block'
			}
			else{suggestions.innerHTML = ''		    
				if (response.data.length > 0){
					document.getElementById('particles-js').style.display = 'none'
					document.getElementById("suggestions-content").style.display = 'block';
					document.getElementById("defaultOpen").click();
					document.getElementById("problem_tab").style.display = 'block';
					document.getElementById("orders_tab").style.display = 'none';
					suggestions.innerHTML += '<div><h3>Associated Conditions:</h3></div>'
				}
				var suggestion_str = ''
				for (var i=0; i<= response.data.length -1; i++){
					suggestion_str += "<div class='suggestion' data-type='problem' data-cui='" + response.data[i].CUI + "' data-name='" + response.data[i].Problem + "'>"
					suggestion_str += "<h5 class='suggestion-text'>"
					suggestion_str += response.data[i].Problem
					suggestion_str += "</h5>"
					suggestion_str += "</div>"
				}
				suggestions.innerHTML += suggestion_str
				document.getElementById('preloader').style.display = 'none'}

		}).catch(function (error) {

			document.getElementById('preloader').style.display = 'none'
			suggestions.innerHTML = ''
			lastFetchedCUI = ''
			isCheckingOrder = false

		}).then(function () {

			bindProblemsSuggestions()
			highlightSuggestions()

		})

}

// Fetch order results from the API
 async function fetchOrders(CUI){

	
	suggestions.innerHTML = ''

	var bodyUI = {
		"CUIs":
			[
				{
					"CUI": CUI
				}
			]
	}

	document.getElementById('preloader').style.display = 'inline-flex'
	document.getElementById('particles-js').style.display = 'none'					
	await axios.post(apiUrl+'AssocOrders', bodyUI, {headers})
	.then(function (response) {
		
		if(response.data.length==0){
			document.getElementById('particles-js').style.display = 'block'
			// suggestions.innerHTML = '<div><h3>No Data for orders:</h3></div>'
			document.getElementById("suggestions-content").style.display = 'none';
			document.getElementById("problem_tab").style.display = 'none';
			document.getElementById("orders_tab").style.display = 'block';
			document.getElementById("defaultOpenForOrders").click();
			document.getElementById('preloader').style.display = 'none'
		}
		else{suggestions.innerHTML = ''			    
		if (response.data.length > 0){
			if(check_order_for_order==true){suggestions.innerHTML += '<div><h3>Orders Associated with Orders:</h3></div>'}
			else{suggestions.innerHTML += '<div><h3>Orders Associated with Problems:</h3></div>'}
			document.getElementById("problem_tab").style.display = 'none';
			document.getElementById("orders_tab").style.display = 'block';
			document.getElementById("suggestions-content").style.display = 'block';
			document.getElementById("defaultOpenForOrders").click();
			document.getElementById('particles-js').style.display = 'none'
		}
		var suggestion_str = ''
		for (var i=0; i<= response.data.length -1; i++){
			suggestion_str += "<div class='suggestion' data-type='order' data-problem-cui='" + CUI + "' data-cui='" + response.data[i].Code + "' data-name='" + response.data[i].Order + "' parent-problem='"+ parent_problem +"' >"
			suggestion_str += "<h5 class='suggestion-text'>"
			suggestion_str += response.data[i].Order
			suggestion_str += "</h5>"
			suggestion_str += "<span class='tag'>" + response.data[i].Type + "</span>"
			suggestion_str += "</div>"
		}
		suggestions.innerHTML += suggestion_str
		document.getElementById('preloader').style.display = 'none'}
			
	}).catch(function (error) {
			
		document.getElementById('preloader').style.display = 'none'
		suggestions.innerHTML = ''
		lastFetchedCUI = ''
		isCheckingOrder = false
			
	}).then(function () {

		bindOrderSuggestions()
		highlightSuggestions()
			
	})

}

// The function responsible about the cursor
// Takes state as input and processes information

 function getCursorTooltips(state: EditorState) {
 
    return state.selection.ranges
      .filter(range => range.empty)
      .map(range => {

        let line = state.doc.lineAt(range.head)
        currentLineFrom = line.from
        currentLineTo = line.to
		current_line = line.number
		current_state = state
       	let text = line.number + ":" + (range.head - line.from) 
	   	let SearchOptionsCount = "#" + searchOptions.length
		let debugtext = [text, SearchOptionsCount]
        currentRowText = line.text // Gets the text of the current row
        currentPosition = range.head // Gets the 	head position

				
		// Check for line changes
		if(isLineChangeNum == currentLineFrom) {
			isLineChanged = false
		}else{
			orderOnClick=false
			isLineChanged = true
			isLineChangeNum = currentLineFrom
		}

        // remove the length condition to call API cotinuously: (currentRowText.length == 3) && AND currentRowText.length ==4 &&
        if( (currentRowText.length == 3) && currentRowText[0] != '' && currentRowText[0] != '\t'){
			orderOnClick=false
					fetchAutoComplete(currentRowText)
		    }
		if(currentRowText.length ==4 && currentRowText[0]=='\t'){
			orderOnClick=false
				fetchAutoCompleteOrders(currentRowText.trim())
		}


		
		    let index = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g,'').replace('\t','') === currentRowText.toLowerCase().replace(/\s/g,''))
			// console.log(currentRowText, index)	
			if (index !== -1) {
					
					

						if (arrCUIs[index]['type'] == 'problem'){
							orderOnClick=false
							lastFetchedCUI = arrCUIs[index]['cui'].toString()
							isCheckingOrder = false
							fetchProblems(lastFetchedCUI)
						}else{
								if(orderOnClick==false){
								check_order_for_order=true
								lastFetchedCUI = arrCUIs[index]['ordercui'].toString()
								isCheckingOrder = true
								fetchOrders(lastFetchedCUI)
							}
						}

				}
				if (line.number > 1){
					let temp_line = line.number
					let previousLine=""
					for(; temp_line > 1;){
						temp_line--
						if(state.doc.line(temp_line).text.length == state.doc.line(temp_line).text.trim().length){
							previousLine = state.doc.line(temp_line).text
							parent_problem = previousLine
							break
						}
					}
					let index1 = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g,'').replace('\t','') === currentRowText.toLowerCase().replace(/\s/g,''))
					
					if (index1 !== -1) {
						if(isCheckingOrder == false){
							if(arrCUIs[index1]['type'] == 'order'){
								isCheckingOrder=true
								check_order_for_order=true
								lastFetchedCUI = arrCUIs[index1]['ordercui'].toString()
								fetchOrders(lastFetchedCUI)
								}
						}
					}
					let previouslineIndex = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g,'').replace('\t','') === previousLine.toLowerCase().replace(/\s/g,''))
				
					if (previouslineIndex !== -1 && index1 === -1 && isLineChanged == true) {   
							if (arrCUIs[previouslineIndex]['type'] == 'problem'){
						
									check_order_for_order=false
									lastFetchedCUI = arrCUIs[previouslineIndex]['cui'].toString()
									isCheckingOrder = true
									fetchOrders(lastFetchedCUI)
							
							}
					}	
			}

				if (line.number == 1 && state.doc.line(line.number).text == ''){
					suggestions.innerHTML = ''
					document.getElementById("problem_tab").style.display = "none"
					document.getElementById("particles-js").style.display = "block"
					lastFetchedCUI = ''
					isCheckingOrder = false
				}

				
        highlightSuggestions()
		return {
			pos: range.head,
			above: true,
			strictSide: true,
			arrow: true,
			create: () => {
			  let dom = document.createElement("div")
			  dom.className = "cm-tooltip-cursor"
			  dom.textContent = debugtext.toString()
			  return {dom}
			}
		  }
      })

 }


// Initialization of the state
// All necessary extensions added to it
// Cursor Movement, Auto Completion, and The use of Tab to indent

const initialState = EditorState.create({
  doc: '',
  extensions: [
  	basicSetup,
  	keymap.of([indentWithTab]),
  	myTheme,
  	cursorTooltip(),
  	autocompletion({override: [myCompletions]}),
  	EditorView.lineWrapping,
  	indentUnit.of("\t")
  ],
})

// Initialization of the EditorView

const view = new EditorView({
  parent: document.getElementById('editor'),
  state: initialState,
})

// Focuses on the view on page load to let physicians type immediately

window.onload = function(){
	view.focus()
}

// Resets the position back to the view
// When someone clicks the title of the block that contains the editor

document.getElementById('editor-container').onclick = function(){
	view.focus()
}


// document.getElementById('jsondata').onclick = function(){
// 	console.log(dataJson)
// }
// This function handles the behavior of clicking an order
// from the sidebar

function bindOrderSuggestions(){

	let all_suggestions = document.getElementsByClassName('suggestion')
	let index1 = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g,'').replace('\t','') === currentRowText.toLowerCase().replace(/\s/g,''))
	for(var i=0; i <= all_suggestions.length - 1; i++){
		
		var elem = all_suggestions[i]
		elem.addEventListener('click', function(e) {
			dataJson[0].Problems.filter(i=>{
				if(i.ProblemText==this.getAttribute('parent-problem')){
					i.Orders.push({
						"OrderCUI": this.getAttribute('data-cui'),
						"OrderText": this.getAttribute('data-name'),
					})
				}
			})
			
			arrCUIs.push({
				type: this.getAttribute('data-type'),
				ordercui: this.getAttribute('data-cui'),
				name: this.getAttribute('data-name'),
				problemCui: this.getAttribute('data-problem-cui')
			})
			var content = ''
			if(currentRowText.length==0 || currentRowText.trim().length==0){
				orderOnClick=true
				content += '\t'
				content += this.getAttribute('data-name')
				content += '\n'
				view.dispatch(
					view.state.update({
			  		changes: {from: currentLineFrom, to:currentLineTo, insert: content} })
				)
				currentPosition = currentLineFrom+content.length
				let setCursor = EditorSelection.cursor(currentPosition)
				view.focus()
				view.dispatch(
				  view.state.update({
					// selection: new EditorSelection([EditorSelection.cursor(currentPosition)], 0)
					selection: setCursor
				})
			  )	
			  
			}
			else if(currentRowText.startsWith('\t') && index1===-1){
				content += '\t'
				content += this.getAttribute('data-name')
				view.dispatch({
					changes: {from: currentLineFrom,to: currentLineTo, insert: content}
				  })
				currentPosition=  currentLineFrom+content.length
				let setCursor = EditorSelection.cursor(currentPosition)
				view.focus()
				view.dispatch(
				  view.state.update({
					// selection: new EditorSelection([EditorSelection.cursor(currentPosition)], 0)
					selection: setCursor
				})
			  )	
			}else{
			let get_line_before_problem: number
			let totalline = current_state.doc.lines;
			
			for(var i= current_line; i <=totalline;i++){
				let get_line = current_state.doc.line(i);
				if(!get_line.text.startsWith('\t')){
					break
				}
				get_line_before_problem = i
			}
			let final_line = current_state.doc.line(get_line_before_problem);
			content += '\n'
			content += '\t'
			content += this.getAttribute('data-name')
			view.dispatch({
				changes: {from: final_line.to, insert: content}
			  })
			}
			document.getElementById('suggestions-content').innerHTML = ''
		
			view.focus()
			
	    highlightSuggestions()
		})
		// elem.onclick = function(e){
	
		// }

	}

}

// This function handles the behavior of clicking a problem
// from the sidebar

function bindProblemsSuggestions(){

	let all_suggestions = document.getElementsByClassName('suggestion')

	for(var i=0; i <= all_suggestions.length - 1; i++){
		
		var elem = all_suggestions[i]
		elem.addEventListener('click', function(e) {
		
			let test = dataJson[0].Problems.filter(item=>{
				if(item.ProblemText==this.getAttribute('data-name')){
					return item
				}
			})
			if(test.length==0){
				dataJson[0].Problems.push({
					"ProblemText": this.getAttribute('data-name'),
					"ProblemCUI": this.getAttribute('data-cui'),
					"Orders":[],
				})
			}

			arrCUIs.push({
				type: this.getAttribute('data-type'),
				cui: this.getAttribute('data-cui'),
				name: this.getAttribute('data-name')
			})
			var content = '\n\n'
			content += this.getAttribute('data-name')
			var newPosition = view.state.doc.length
			view.dispatch({
			  changes: {from: newPosition, insert: content}
			})
			view.focus()
			highlightSuggestions()
		})
		// elem.onclick = function(e){
			
		// }

	}

}


// Send data to create clinical note apiUrl
let BinaryUrl = ""
let getSendButton = document.getElementById('clinicalCreate')
getSendButton.addEventListener('click', function(e){
	let clinicalNoteBody = {}
	let EncodedString = window.btoa(current_state.doc.toString());
	if(MI1_Client_ID == '123456789'){
		clinicalNoteBody = {
			"MI1ClientID":MI1_Client_ID,
			"patientId":PatientId,
			"note_type_code":"11488-4",
			"note_content":EncodedString
		}
	}
	else{
		clinicalNoteBody = {
			"MI1ClientID":MI1_Client_ID,
			"patientId":PatientId,
			"practitionerReference":"12743472",
			"encounterReference":"97954261",
			"note_content":EncodedString
		}
	}
	
	axios.post(apiUrl_Dev+'ClinicalNote', clinicalNoteBody).then(response=>{
		
		console.log(response)
		if (parseInt(response.data[0].StatusCode)== 201){
			BinaryUrl = response.data[0].BinaryUrl
			alert("Note Created")
		}
		else{
			console.log('Error while processing create Clinical Note ')
			console.log('PatientId: '+PatientId )
			console.log('Response Status Code : '+response.data[0].StatusCode)
			alert('Error while creating note')
			
		}
	})
})

// Read Clinical data
// let getReadButton = document.getElementById('clinicalRead')
// getReadButton.addEventListener('click', function(e){
// 	axios.post(apiUrl+'ClinicalNoteRead',{
// 		"MI1ClientID":MI1_Client_ID,
// 		"patientId":"eXbMln3hu0PfFrpv2HgVHyg3",
// 		'binaryId':BinaryUrl
// 	}).then(response=>{
// 		console.log(response.data);
// 	})
// })

// Read latest 5 Clinical data
let getReadButton = document.getElementById('clinicalRead')
getReadButton.addEventListener('click', function(e){
	axios.post(apiUrl_Dev+'ReadClinicalNotes',{
		"MI1ClientID":MI1_Client_ID,
		"patientId":PatientId
	}).then(response=>{
		let returnData = []
		returnData = response.data
		console.log(returnData['returnData'][0]['DecodedData']);
		let clinicalreadresponsedata = atob(returnData['returnData'][0]['DecodedData']);
		// console.log(JSON.parse(clinicalreadresponsedata[0]))

		view.dispatch({
			changes: {from: currentLineFrom, to: currentLineTo, insert: clinicalreadresponsedata}
		});
	})
})


// This function checks if the document contains problems or orders
// By comparing them to the list of CUIs we collect and save in memory

function highlightSuggestions(){

	let all_suggestions = document.getElementsByClassName('suggestion')

	for(var i=0; i <= all_suggestions.length - 1; i++){
		
		var elem = all_suggestions[i]
		var index = arrCUIs.findIndex(e => e.cui === elem.getAttribute('data-cui'))
		if (index !== -1) {
			if (arrCUIs[index]['type'] == elem.getAttribute('data-type')){
				
				view ? view.state.doc.toJSON().forEach((e)=> {
					(e.toString().toLowerCase().replace(/\s/g,'').replace('\t','') == elem.getAttribute('data-name').toLowerCase().replace(/\s/g,'')) ? elem.classList.add('highlighted') : null
				}) : null

			}
		}
		var index1 = arrCUIs.findIndex(e => e.ordercui === elem.getAttribute('data-cui'))
		if (index1 !== -1) {
			if (arrCUIs[index1]['type'] == elem.getAttribute('data-type')){

					view ? view.state.doc.toJSON().forEach((e)=> {
						(e.toString().toLowerCase().replace(/\s/g,'').replace('\t','') == elem.getAttribute('data-name').toLowerCase().replace(/\s/g,'')) ? elem.classList.add('highlighted') : null
					}) : null
				
			}
		}

	}

}