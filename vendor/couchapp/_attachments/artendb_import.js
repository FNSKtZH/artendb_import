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

function importiereFloraDatensammlungen(tblName, Anz) {
	initiiereImport("importiereFloraDatensammlungen_02", tblName, Anz);
}

function importiereFloraDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, sqlDatensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	sqlDatensammlung = "SELECT * FROM " + tblName + " INNER JOIN tblFloraSisfGuid ON tblFloraSisfGuid.NR = " + tblName + "." + DatensammlungMetadaten[0].DsBeziehungsfeldDs;
	Datensammlung = frageSql(myDB, sqlDatensammlung);
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
		if ((anzDs > (Anz*4000-4000)) && (anzDs <= Anz*4000)) {
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
}

function importiereFauna(myDB) {
	var Datensammlungen, sqlDatensammlungen, Index, Datensamlung, DsDerDatensammlung, Art, DsObjekt, Guid, dsNr;
	sqlDatensammlungen = "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFaunaCscf'";
	Datensammlungen = frageSql(myDB, sqlDatensammlungen);
	//Index importieren
	Index = frageSql(myDB, "SELECT * FROM tblFaunaCscf");
	dsNr = 0;
	for (x in Index) {
		//In Häppchen von max. 8000 Datensätzen aufteilen
		dsNr += 1;
		if ((sessionStorage.fauna === "fauna1" && dsNr < 8000) || (sessionStorage.fauna === "fauna2" && dsNr >= 8000 && dsNr < 16000) || (sessionStorage.fauna === "fauna3" && dsNr >= 16000)) {
			//Art als Objekt gründen
			Art = {};
			//_id soll GUID sein, aber ohne Klammern
			Art._id = Index[x].GUID.slice(1, 37);
			//Datensammlung als Objekt gründen, heisst wie DsName
			Art[Datensammlungen[0].DsName] = {};
			Art[Datensammlungen[0].DsName].Typ = "Datensammlung";
			//Felder der Datensammlung als Objekt gründen
			Art[Datensammlungen[0].DsName].Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			for (y in Index[x]) {
				if (y !== "id" && Index[x][y] !== "" && Index[x][y] !== null) {
					if (y !== "GUID") {
						Art[Datensammlungen[0].DsName].Felder[y] = Index[x][y];
					} else {
						Art[Datensammlungen[0].DsName].Felder[y] = Index[x][y].slice(1, 37);
					}
				}
			}
			$db = $.couch.db("artendb");
			$db.saveDoc(Art);
		}
	}
	delete sessionStorage.fauna;
}

function importiereFaunaDatensammlungen(tblName, Anz) {
	initiiereImport("importiereFaunaDatensammlungen_02", tblName, Anz);
}

function importiereFaunaDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, sqlDatensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	sqlDatensammlung = "SELECT * FROM " + tblName + " INNER JOIN tblFaunaCscfGuid ON tblFaunaCscfGuid.NR = " + tblName + "." + DatensammlungMetadaten[0].DsBeziehungsfeldDs;
	Datensammlung = frageSql(myDB, sqlDatensammlung);
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
		if ((anzDs > (Anz*4000-4000)) && (anzDs <= Anz*4000)) {
			//Datensammlung als Objekt gründen
			DatensammlungDieserArt = {};
			DatensammlungDieserArt.Typ = "Datensammlung";
			//Felder der Datensammlung als Objekt gründen
			DatensammlungDieserArt.Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			anzFelder = 0;
			for (y in Datensammlung[x]) {
				if (y !== "id" && y !== "GUID" && y !== "NR" && y !== "tblFaunaCscfGuid.NR" && y !== "Nuesp" && y !== "Gruppe" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null && y !== DatensammlungMetadaten[0].DsBeziehungsfeldDs) {
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

function initiiereImport(functionName, tblName, Anz) {
	var myDB;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	//in der Couch anmelden
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
				eval(functionName + "(myDB, tblName, Anz)");
			} else {
				eval(functionName + "(myDB)");
			}
		}
	});
}

function verbindeMitMdb() {
	var myDB, dbPfad;
	if ($("#dbpfad").val()) {
		dbPfad = $("#dbpfad").val();
	} else {
		dbPfad = "C:\\Users\\alex\\artendb_import\\export_in_json.mdb";
	}
	myDB = new ACCESSdb(dbPfad, {showErrors:true});
	return myDB;
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

function baueDatensammlungenSchaltflächenAuf() {
	var DatensammlungenFlora, sqlDatensammlungenFlora, DatensammlungenFauna, sqlDatensammlungenFauna, myDB, html, qryAnzDs, anzDs, anzButtons;
	myDB = verbindeMitMdb();
	sqlDatensammlungenFlora = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblFloraSisf' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblFloraSisf' ORDER BY DsReihenfolge";
	DatensammlungenFlora = frageSql(myDB, sqlDatensammlungenFlora);
	if (DatensammlungenFlora) {
		html = "";
		for (i in DatensammlungenFlora) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenFlora[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenFlora[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/4000);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='";
				html += DatensammlungenFlora[i].DsTabelle + y;
				html += "' name='SchaltflächeFloraDatensammlung' Tabelle='" + DatensammlungenFlora[i].DsTabelle;
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>";
				html += DatensammlungenFlora[i].DsName;
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenFloraDatensammlungen").html(html);
		//jetzt Fauna
		sqlDatensammlungenFauna = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblFaunaCscf' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblFaunaCscf' ORDER BY DsReihenfolge";
		DatensammlungenFauna = frageSql(myDB, sqlDatensammlungenFauna);
		html = "";
		for (i in DatensammlungenFauna) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenFauna[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenFauna[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/4000);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='";
				html += DatensammlungenFauna[i].DsTabelle + y;
				html += "' name='SchaltflächeFaunaDatensammlung' Tabelle='" + DatensammlungenFauna[i].DsTabelle;
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>";
				html += DatensammlungenFauna[i].DsName;
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenFaunaDatensammlungen").html(html);
	} else {
		alert("Bitte den Pfad zur .mdb erfassen");
	}
		
}