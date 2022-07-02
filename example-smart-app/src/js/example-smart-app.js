(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      console.log('Patient present in smart:' , smart.hasOwnProperty('patient'))
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }
          

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);
          p.id = patient.id;
          
          
          // let getMRN = patient.identifier;

          // for(i=0 ; i <= getMRN.length ; i++) {
          //   getText = i.find('text')
          //   if (getText != null && getText['value'] == "EPI"){
          //     mrnValue = i.find('value')

          //     patientMRN = mrnValue['value']
          //   }
          // }
          // p.mrn = patientMRN; 

          // console.log("printing mrn after loop" , p.mrn);
          // Object.entries(getMRN).forEach(([key, value]) => {
          //   if(key == 1){
          //     console.log("printing from inside");
          //     console.log(value[value]);
          //   }
          // });
          // var obj = JSON.parse(getMRN);

          // // Define recursive function to print nested values
          // function printValues(obj) {
          //     for(var k in obj) {
          //         if(obj[k] instanceof Object) {
          //             printValues(obj[k]);
          //         } else {
          //             document.write(obj[k] + "<br>");
          //         };
          //     }
          // };

          // console.log("printing get mrn", getMRN);
          // let obj = getMRN[1];
          // console.log("printing obj" , obj);
          // let obj2 = JSON.parse(obj);
          // console.log("printing obj2" , obj2);
          // let split1 = String(obj2);
          // console.log('split 1: ' + split1);
          // let split2 = String(split1.split(","));
          // console.log("printing split2", split2[1]);
          // let split3 = String(split2[1].split(":"));
          // console.log('printing split 3', split3[1]);

          // console.log("helo", getMRN[1][value]);

          // let tempvar = patient.identifier[1]; 
          // console.log("printing patient: ", patient); 
          // console.log("printing getMRn: ", getMRN); 
          // console.log("printing tempvar[1]: ", tempvar);
          // console.log("printing getmrn value: ", getMRN[1].join(' '));
          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      id: {value: ''},
      mrn: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').hide();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
    $('#id').html(p.id);
    $('#mrn').html(p.mrn);
  };

})(window);
