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

function importiereFlora(myDB) {
	var Datensammlungen, sqlDatensammlungen, Index, Datensamlung, DsDerDatensammlung, Art, DsObjekt, Guid;
	sqlDatensammlungen = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblFloraSisf' AND DsBeziehungstyp = '1_zu_1' ORDER BY DsReihenfolge";
	Datensammlungen = frageSql(myDB, sqlDatensammlungen);
	//Index importieren
	for (i in Datensammlungen) {
		//alert("Datensammlungen[i].DsTabelle = " + Datensammlungen[i].DsTabelle);
		if (Datensammlungen[i].DsTabelle === Datensammlungen[i].DsIndex) {
			Index = frageSql(myDB, "SELECT * FROM " + Datensammlungen[i].DsTabelle);
			for (x in Index) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein, aber ohne Klammern
				Art._id = Index[x].GUID.slice(1, 37);
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
							Art[Datensammlungen[i].DsName].Felder[y] = Index[x][y].slice(1, 37);
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
		break;
	}
}

function importiereFloraDatensammlungen(tblName) {
	initiiereImport(importiereFloraDatensammlungen_02, tblName);
}

function importiereFloraDatensammlungen_02(myDB, tblName) {
	var DatensammlungMetadaten, Datensammlung, sqlDatensammlung, DatensammlungDieserArt, anzFelder;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	sqlDatensammlung = "SELECT * FROM " + tblName + " INNER JOIN tblFloraSisfGuid ON tblFloraSisfGuid.NR = " + tblName + "." + DatensammlungMetadaten[0].DsBeziehungsfeldDs;
	Datensammlung = frageSql(myDB, sqlDatensammlung);
	for (x in Datensammlung) {
		//Datensammlung als Objekt gründen
		DatensammlungDieserArt = {};
		DatensammlungDieserArt.Typ = "Datensammlung";
		//Felder der Datensammlung als Objekt gründen
		DatensammlungDieserArt.Felder = {};
		//Felder anfügen, wenn sie Werte enthalten
		anzFelder = 0;
		for (y in Datensammlung[x]) {
			if (y !== "id" && y !== "GUID" && y !== "NR" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null && y !== DatensammlungMetadaten[0].DsBeziehungsfeldDs && y !== "Gruppe") {
				DatensammlungDieserArt.Felder[y] = Datensammlung[x][y];
				anzFelder += 1;
			}
		}
		//entsprechenden Index öffnen
		//sicherstellen, dass Felder vorkommen. Gibt sonst einen Fehler
		if (anzFelder > 0) {
			//Datenbankabfrage ist langsam. Estern aufrufen, 
			//sonst überholt die for-Schlaufe und DatensammlungDieserArt ist bis zur saveDoc-Ausführung eine andere!
			fuegeDatensammlungZuArt(Datensammlung[x].GUID, DatensammlungMetadaten[0].DsName, DatensammlungDieserArt);
		}
	}
}

function fuegeDatensammlungZuArt(GUID, DsName, DatensammlungDieserArt) {
	$db = $.couch.db("artendb");
	$db.openDoc(GUID, {
		success: function (doc) {
			//Datensammlung anfügen
			doc[DsName] = DatensammlungDieserArt;
			//in artendb speichern
			$db.saveDoc(doc);
		}
	});
}

function initiiereImport(functionName, tblName) {
	var myDB = new ACCESSdb("C:\\Users\\alex\\artendb_import\\export_in_json.mdb", {showErrors:true});
	$.ajax({
		type: "POST", 
		url: "http://127.0.0.1:5984/_session",
		dataType: "json",
		data: {
			name: 'barbalex', 
			password: 'dLhdMg12'
		},
		beforeSend: function(xhr) {
			xhr.setRequestHeader('Accept', 'application/json');
		},
		success: function (data) {
			//DB übergeben
			if (tblName) {
				eval(functionName(myDB, tblName));
			} else {
				eval(functionName(myDB));
			}
		}
	});
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