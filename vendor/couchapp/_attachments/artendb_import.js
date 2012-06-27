function importiereFauna() {
	var myDB = new ACCESSdb("C:\\Users\\alex\\artendb_import\\export_in_json.mdb", {showErrors:true});
	$.ajax({
		type: "POST", 
		url: "http://127.0.0.1:5984/_session",
		dataType: "json",
				data: {name: 'barbalex', password: 'dLhdMg12'},
				beforeSend: function(xhr) {
						xhr.setRequestHeader('Accept', 'application/json');
				},
				success: function (data) {
					//DB übergeben und Anfangswert 1
					importiereFauna_02(myDB, 1);
				}
	});
}

function importiereFauna_02(myDB, startwert, endwert) {
	//die ersten 10 posts reagieren nicht!!!!!!??????
	//darum am Ende nochmals die ersten 10 aufrufen
	if (!endwert) {
		endwert = startwert + 50;
	}
	d = frageSql(myDB, "SELECT * FROM tblFaunaExport WHERE id >= " + startwert + " AND id <= " + endwert);
	for (i in d) {
		//_id soll GUID sein
		d[i]._id = d[i].fns_Guid;
		//leerwerte entfernen
		for (y in d[i]) {
			if (y === "id" || d[i][y] === "" || d[i][y] === null) {
				delete d[i][y];
			}
		}
	}
	importiereJsonObjekt(d);
	//weiter mit den nächsten x Datensätzen, wenn tblFaunaExport weitere Datensätze enthält
	//alert(d.length);
	if (d.length > 50) {
		importiereFauna_02(myDB, endwert);
	} else {
		//die ersten 10 posts reagieren nicht!!!!!!??????
		//darum am Ende nochmals die ersten 10 aufrufen
		importiereFauna_02(myDB, 1, 500);
	}
}

function importiereFlora() {
	var myDB = new ACCESSdb("C:\\Users\\alex\\artendb_import\\export_in_json.mdb", {showErrors:true});
	$.ajax({
		type: "POST", 
		url: "http://127.0.0.1:5984/_session",
		dataType: "json",
				data: {name: 'barbalex', password: 'dLhdMg12'},
				beforeSend: function(xhr) {
						xhr.setRequestHeader('Accept', 'application/json');
				},
				success: function (data) {
					//DB übergeben und Anfangswert 1
					importiereFlora_02(myDB);
				}
	});
}

function importiereFlora_02(myDB) {
	var Datensammlungen, sqlDatensammlungen, Index, Datensamlung, DsDerDatensammlung, Art, DsObjekt, Guid;
	sqlDatensammlungen = "SELECT * FROM tblDatensammlung WHERE DsIndex = 'tblFloraSisf' AND DsBeziehungstyp = '1_zu_1' ORDER BY DsReihenfolge";
	Datensammlungen = frageSql(myDB, sqlDatensammlungen);
	//Index importieren
	for (i in Datensammlungen) {
		//alert("Datensammlungen[i].DsTabelle = " + Datensammlungen[i].DsTabelle);
		if (Datensammlungen[i].DsTabelle === Datensammlungen[i].DsIndex) {
			Index = frageSql(myDB, "SELECT * FROM " + Datensammlungen[i].DsTabelle);
			//alert("Index = " + JSON.stringify(Index));
			for (x in Index) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein, aber ohne Klammern
				Art._id = Index[x].GUID.slice(1, 36);
				//alert("Art = " + JSON.stringify(Art));
				//alert("Datensammlungen[i].DsName = " + Datensammlungen[i].DsName);
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art[Datensammlungen[i].DsName] = {};
				Art[Datensammlungen[i].DsName].Typ = "Datensammlung";
				//Felder der Datensammlung als Objekt gründen
				Art[Datensammlungen[i].DsName].Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in Index[x]) {
					if (y !== "id" && Index[x][y] !== "" && Index[x][y] !== null) {
						if (y !== "GUID") {
							Art[Datensammlungen[i].DsName].Felder[y] = Index[x][y];
						} else {
							Art[Datensammlungen[i].DsName].Felder[y] = Index[x][y].slice(1, 36);
						}
					}
				}
				//alert("Art = " + JSON.stringify(Art));
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
			//importiereJsonObjekt(Art);
		}
		break;
	}
	//danach durch alle übrigen Datensammlungen loopen und ihre Felder in ein Objekt mit Namen und Eigenschaften der Datensammlung einfügen
	for (i in Datensammlungen) {
		//Nur Datensammlungen, die nicht der Index sind
		if (Datensammlungen[i].DsTabelle !== Datensammlungen[i].DsIndex) {
			//Datensätze der Datensammlung abfragen
			DsDerDatensammlung = frageSql(myDB, "SELECT * FROM " + Datensammlungen[i].DsTabelle);
			//alert("DsDerDatensammlung = " + JSON.stringify(DsDerDatensammlung));
			for (x in DsDerDatensammlung) {
				//Datensammlung als Objekt gründen
				Datensammlung = {};
				Datensammlung.Typ = "Datensammlung";
				//Felder der Datensammlung als Objekt gründen
				Datensammlung.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in DsDerDatensammlung[x]) {
					if (y !== "id" && DsDerDatensammlung[x][y] !== "" && DsDerDatensammlung[x][y] !== null) {
						Datensammlung.Felder[y] = DsDerDatensammlung[x][y];
					}
				}
				//entsprechenden Index öffnen
				$db = $.couch.db("artendb");
				//GUID herausfinden
				//alert("Datensammlungen[i].DsBeziehungsfeldDs = " + Datensammlungen[i].DsBeziehungsfeldDs);
				Guid = frageSql(myDB, "SELECT GUID FROM tblFloraSisf WHERE NR = " + DsDerDatensammlung[x][Datensammlungen[i].DsBeziehungsfeldDs]);
				//alert("Guid[0].GUID.slice(1, 36) = " + Guid[0].GUID.slice(1, 36));
				$db.openDoc(Guid[0].GUID.slice(1, 36), {
					success: function (doc) {
						//Datensammlung anfügen
						doc[Datensammlungen[i].DsName] = Datensammlung;
						alert("doc[Datensammlungen[i].DsName] = " + JSON.stringify(doc[Datensammlungen[i].DsName]));
						//in DB speichern
						$db.saveDoc(doc);
					}
				});
			}
		}
	}
}

//nimmt die DB und einen sql-String entgegen
//fragt die DB ab und retourniert ein JSON-Objekt
function frageSql(db, sql) {
	var qry, a, b, c, d;
	qry = db.query(sql, {json:true});
	var a = JSON.stringify(qry);
	//Rückgabewert ist in "" eingepackt > entfernen
	var b = a.slice(1, a.length -1);
	//im Rückgabewert sind alle " mit \" ersetzt. Das ist kein valid JSON!
	var c = b.replace(/\\\"/gm, "\"");
	//jetzt haben wir valid JSON. In ein Objekt parsen
	d = JSON.parse(c);
	return d;
}

//nimmt ein JSON Objekt entgegen
//importiert es in die CouchDb
function importiereJsonObjekt(JsonObjekt) {
	var Doc;
	Doc = '{ "docs":' + JSON.stringify(JsonObjekt) + '}';
	$.ajax({
		type: "post", 
		url: "http://127.0.0.1:5984/artendb/_bulk_docs",
		contentType: "application/json",
		data: Doc
	});
}