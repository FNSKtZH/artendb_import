function importiereFloraIndex(Anz) {
	$.when(initiiereImport()).then(function() {
		var Art, anzDs, andereArt, offizielleArt;
		//Metadaten laden, wenn nicht schon vorhanden
		if (!window.tblDatensammlungMetadaten) {
			window.tblDatensammlungMetadaten = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFloraSisf'");
		}
		//Index laden, nur wenn nicht schon vorhanden
		if (!window.tblFloraSisf) {
			window.tblFloraSisf = frageSql(window.myDB, "SELECT * FROM tblFloraSisf_import");
		}
		anzDs = 0;
		for (var x in window.tblFloraSisf) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
			if ((anzDs > (Anz*window.tblDatensammlungMetadaten[0].DsAnzDs-window.tblDatensammlungMetadaten[0].DsAnzDs)) && (anzDs <= Anz*window.tblDatensammlungMetadaten[0].DsAnzDs)) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein
				Art._id = window.tblFloraSisf[x].GUID;
				Art.Gruppe = window.tblFloraSisf[x].Gruppe;
				//Bezeichnet den Typ des Dokuments. Objekt = Art oder Lebensaum. Im Gegensatz zu Beziehung
				Art.Typ = "Objekt";
				//Taxonomie als Objekt gründen, heisst wie DsName
				Art.Taxonomie = {};
				//Datensammlungen und Beziehungssammlungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungssammlungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.tblDatensammlungMetadaten[0].DsName;
				Art.Taxonomie.Beschreibung = window.tblDatensammlungMetadaten[0].DsBeschreibung;
				if (window.tblDatensammlungMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.tblDatensammlungMetadaten[0].DsDatenstand;
				}
				if (window.tblDatensammlungMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.tblDatensammlungMetadaten[0].DsLink;
				}
				//Daten der Datensammlung als Objekt gründen
				Art.Taxonomie.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				for (var y in window.tblFloraSisf[x]) {
					if (window.tblFloraSisf[x][y] !== "" && window.tblFloraSisf[x][y] !== null && y !== "Gruppe" && y !== "Synonym von") {
						if (window.tblFloraSisf[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Daten[y] = true;
						} else if (y === "Offizielle Art") {
							andereArt = frageSql(window.myDB, "SELECT [Artname vollständig] as Artname FROM tblFloraSisf_import where GUID='" + window.tblFloraSisf[x][y] + "'");
							var DsSynonyme = {};
							DsSynonyme.Name = "SISF Index 2 (2005): offizielle Art";
							DsSynonyme.Typ = "taxonomisch";
							DsSynonyme.Beschreibung = Art.Taxonomie.Beschreibung;
							if (Art.Taxonomie.Datenstand) {
								DsSynonyme.Datenstand = Art.Taxonomie.Datenstand;
							}
							if (Art.Taxonomie.Link) {
								DsSynonyme["Link"] = Art.Taxonomie.Link;
							}
							DsSynonyme["Art der Beziehungen"] = "offizielle Art";
							//aus dem Synonym ein Objekt bilden
							var Synonym = {};
							Synonym.Gruppe = "Flora";
							Synonym.GUID = window.tblFloraSisf[x][y];
							Synonym.Name = andereArt[0].Artname;
							var Beziehungspartner = [];
							Beziehungspartner.push(Synonym);
							var BeziehungsObjekt = {};
							BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
							DsSynonyme.Beziehungen = [];
							DsSynonyme.Beziehungen.push(BeziehungsObjekt);
							if (!Art.Beziehungssammlungen) {
								Art.Beziehungssammlungen = [];
							}
							Art.Beziehungssammlungen.push(DsSynonyme);
							//Datensammlungen nach Name sortieren
							Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
						} else if (y !== "GUID") {
							//GUID ist _id, kein eigenes Feld
							Art.Taxonomie.Daten[y] = window.tblFloraSisf[x][y];
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
	});
}

function ergänzeFloraDeutscheNamen() {
	$.when(initiiereImport()).then(function() {
		var qryDeutscheNamen;
		qryDeutscheNamen = frageSql(window.myDB, "SELECT SisfNr, NOM_COMMUN FROM tblFloraSisfNomCommun INNER JOIN tblFloraSisfNomComTax ON tblFloraSisfNomCommun.NO_NOM_COMMUN = tblFloraSisfNomComTax.NO_NOM_COMMUN ORDER BY NOM_COMMUN");
		$db = $.couch.db("artendb");
		$db.view('artendb/flora?include_docs=true', {
			success: function (data) {
				for (var i in data.rows) {
					var Art, ArtNr, deutscheNamen;
					Art = data.rows[i].doc;
					ArtNr = Art.Taxonomie.Daten["Taxonomie ID"];
					deutscheNamen = "";
					for (var k in qryDeutscheNamen) {
						if (qryDeutscheNamen[k].SisfNr === ArtNr) {
							if (deutscheNamen) {
								deutscheNamen += ', ';
							}
							deutscheNamen += qryDeutscheNamen[k].NOM_COMMUN;
						}
					}
					if (deutscheNamen && deutscheNamen !== Art.Taxonomie.Daten["Name Deutsch"]) {
						Art.Taxonomie.Daten["Name Deutsch"] = deutscheNamen;
						$db = $.couch.db("artendb");
						$db.saveDoc(Art);
					}
				}
			}
		});
	});
}

function aktualisiereFloraGültigeNamen() {
	$db = $.couch.db("artendb");
	$db.view('artendb/flora?include_docs=true', {
		success: function (data) {
			var Art, Nrn;
			for (var i in data.rows) {
				Art = data.rows[i].doc;
				//Liste aller Deutschen Namen bilden
				if (Art.Taxonomie.Daten["Gültige Namen"]) {
					//es gibt gültige Namen
					var GueltigeNamen, DsGueltigeNamen, BeziehungsObjekt, Beziehungspartner;
					Nrn = Art.Taxonomie.Daten["Gültige Namen"].split(",");
					//es gibt Synonyme
					DsGueltigeNamen = {};
					DsGueltigeNamen.Name = "SISF Index 2 (2005): gültige Namen";
					DsGueltigeNamen.Typ = "taxonomisch";
					DsGueltigeNamen.Beschreibung = Art.Taxonomie.Beschreibung;
					if (Art.Taxonomie.Datenstand) {
						DsGueltigeNamen.Datenstand = Art.Taxonomie.Datenstand;
					}
					if (Art.Taxonomie.Link) {
						DsGueltigeNamen["Link"] = Art.Taxonomie.Link;
					}
					DsGueltigeNamen["Art der Beziehungen"] = "gültige Namen";
					DsGueltigeNamen.Beziehungen = [];
					for (var a in Nrn) {
						//durch alle gültigen Nummern loopen
						for (var k in data.rows) {
							//jeweils die passende Art suchen
							if (data.rows[k].doc.Taxonomie.Daten["Taxonomie ID"] == parseInt(Nrn[a], 10)) {
								Beziehungspartner = [];
								GueltigeNamen = {};
								GueltigeNamen.Gruppe = "Flora";
								GueltigeNamen.GUID = data.rows[k].doc._id;
								GueltigeNamen.Name = data.rows[k].doc.Taxonomie.Daten["Artname vollständig"];
								Beziehungspartner.push(GueltigeNamen);
								BeziehungsObjekt = {};
								BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
								DsGueltigeNamen.Beziehungen.push(BeziehungsObjekt);
								break;
							}
						}
					}
					if (DsGueltigeNamen.Beziehungen !== []) {
						delete Art.Taxonomie.Daten["Gültige Namen"];
						if (!Art.Beziehungssammlungen) {
							Art.Beziehungssammlungen = [];
						}
						Art.Beziehungssammlungen.push(DsGueltigeNamen);
						//Datensammlungen nach Name sortieren
						Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
						$db.saveDoc(Art);
					}
				}
			}
		}
	});
}

function ergänzeFloraEingeschlosseneArten() {
	$.when(initiiereImport()).then(function() {
		var qryEingeschlosseneArten = frageSql(window.myDB, "SELECT IIf([tblFloraSisf].[Deutsch] Is Not Null,[tblFloraSisf].[Name] & ' (' & [tblFloraSisf].[Deutsch] & ')',[tblFloraSisf].[Name]) AS [Artname vollständig], Mid([tblFloraSisf].[GUID],2,36) AS GUID_eingeschlossen, Mid([tblFloraSisf_1].[GUID],2,36) AS [GUID] FROM tblFloraSisf AS tblFloraSisf_1 INNER JOIN (tblFloraSisf INNER JOIN tblFloraSisfAggrSl ON tblFloraSisf.NR = tblFloraSisfAggrSl.NO_NOM_INCLU) ON tblFloraSisf_1.NR = tblFloraSisfAggrSl.NO_AGR_SL ORDER BY IIf([tblFloraSisf].[Deutsch] Is Not Null,[tblFloraSisf].[Name] & ' (' & [tblFloraSisf].[Deutsch] & ')',[tblFloraSisf].[Name])");
		$db = $.couch.db("artendb");
		$db.view('artendb/flora?include_docs=true', {
			success: function (data) {
				for (var i in data.rows) {
					//durch alle Arten loopen
					var Art, Einschluss, DsEinschluss, BeziehungsObjekt, Beziehungspartner;
					Art = data.rows[i].doc;
					for (var x in Art) {
						if (Art.Taxonomie.Daten && Art.Taxonomie.Daten["Eingeschlossene Arten"]) {
							//es gibt Synonyme
							DsEinschluss = {};
							DsEinschluss.Name = "SISF Index 2 (2005): eingeschlossene Arten";
							DsEinschluss.Typ = "taxonomisch";
							DsEinschluss.Beschreibung = Art.Taxonomie.Beschreibung;
							if (Art.Taxonomie.Datenstand) {
								DsEinschluss.Datenstand = Art.Taxonomie.Datenstand;
							}
							if (Art.Taxonomie.Link) {
								DsEinschluss["Link"] = Art.Taxonomie.Link;
							}
							DsEinschluss["Art der Beziehungen"] = "eingeschlossen";
							DsEinschluss.Beziehungen = [];
							for (var k in qryEingeschlosseneArten) {
								//durch alle Synonyme loopen
								if (qryEingeschlosseneArten[k].GUID == Art._id) {
									//aus dem Synonym ein Objekt bilden
									Beziehungspartner = [];
									Einschluss = {};
									Einschluss.Gruppe = "Flora";
									Einschluss.GUID = qryEingeschlosseneArten[k]["GUID_eingeschlossen"];
									Einschluss.Name = qryEingeschlosseneArten[k]["Artname vollständig"];
									Beziehungspartner.push(Einschluss);
									BeziehungsObjekt = {};
									BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
									DsEinschluss.Beziehungen.push(BeziehungsObjekt);
								}
							}
							if (!Art.Beziehungssammlungen) {
								Art.Beziehungssammlungen = [];
							}
							Art.Beziehungssammlungen.push(DsEinschluss);
							//Datensammlungen nach Name sortieren
							Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
							delete Art.Taxonomie.Daten["Eingeschlossene Arten"];
							$db.saveDoc(Art);
							//wir müssen nicht durch weitere Eigenschaften der Art loopen
							break;
						}
					}
				}
			}
		});
	});
}

function ergänzeFloraEingeschlossenIn() {
	$.when(initiiereImport()).then(function() {
		var Artenliste = frageSql(window.myDB, 'SELECT tblFloraSisf_import.GUID FROM tblFloraSisfAggrSl INNER JOIN tblFloraSisf_import ON tblFloraSisfAggrSl.NO_NOM_INCLU = tblFloraSisf_import.[Taxonomie ID] GROUP BY tblFloraSisf_import.GUID');
		var guidArray = [];
		var a = 0;
		var batch = 150;
		var batchGrösse = 150;
		for (a; a<batch; a++) {
			if (a < Artenliste.length) {
				guidArray.push(Artenliste[a].GUID);
				if (a === (batch-1)) {
					ergänzeFloraEingeschlossenIn_2(guidArray, (a-batchGrösse));
					guidArray = [];
					batch += batchGrösse;
				}
			} else {
				ergänzeFloraEingeschlossenIn_2(guidArray, (a-batchGrösse));
				break;
			}
		}
	});
}

function ergänzeFloraEingeschlossenIn_2(guidArray, a) {
	setTimeout(function() {
		$db = $.couch.db("artendb");
		$db.view('artendb/all_docs?keys=' + encodeURI(JSON.stringify(guidArray)) + '&include_docs=true', {
			success: function (data) {
				var Art;
				for (var f = 0; f<data.rows.length; f++) {
					Art = data.rows[f].doc;
					ergänzeFloraEingeschlossenInFuerArt(Art);
				}
			}
		});
	}, a*40);
}

function ergänzeFloraEingeschlossenInFuerArt(Art) {
	var qryFloraEingeschlossenIn, Synonym, DsEingeschlossenIn, BeziehungsObjekt, Beziehungspartner;
	qryFloraEingeschlossenIn = frageSql(window.myDB, 'SELECT tblFloraSisf_import.GUID AS GUID1, tblFloraSisf_import_1.GUID AS GUID2, tblFloraSisf_import_1.[Artname vollständig] FROM (tblFloraSisfAggrSl INNER JOIN tblFloraSisf_import ON tblFloraSisfAggrSl.NO_NOM_INCLU = tblFloraSisf_import.[Taxonomie ID]) INNER JOIN tblFloraSisf_import AS tblFloraSisf_import_1 ON tblFloraSisfAggrSl.NO_AGR_SL = tblFloraSisf_import_1.[Taxonomie ID] WHERE tblFloraSisf_import.GUID="'+Art._id+'"');
	if (qryFloraEingeschlossenIn && qryFloraEingeschlossenIn.length > 0) {
		//es gibt EingeschlossenIn
		for (var k in qryFloraEingeschlossenIn) {
			//durch alle EingeschlossenIn loopen
			if (qryFloraEingeschlossenIn[k].GUID1 === Art._id) {
				DsEingeschlossenIn = {};
				DsEingeschlossenIn.Name = "SISF Index 2 (2005): eingeschlossen in";
				DsEingeschlossenIn.Typ = "taxonomisch";
				DsEingeschlossenIn.Beschreibung = Art.Taxonomie.Beschreibung;
				if (Art.Taxonomie.Datenstand) {
					DsEingeschlossenIn.Datenstand = Art.Taxonomie.Datenstand;
				}
				if (Art.Taxonomie.Link) {
					DsEingeschlossenIn["Link"] = Art.Taxonomie.Link;
				}
				DsEingeschlossenIn["Art der Beziehungen"] = "eingeschlossen in";
				DsEingeschlossenIn.Beziehungen = [];
				//aus dem Synonym ein Objekt bilden
				Beziehungspartner = [];
				Synonym = {};
				Synonym.Gruppe = "Flora";
				Synonym.GUID = qryFloraEingeschlossenIn[k].GUID2;
				Synonym.Name = qryFloraEingeschlossenIn[k]["Artname vollständig"];
				Beziehungspartner.push(Synonym);
				BeziehungsObjekt = {};
				BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
				DsEingeschlossenIn.Beziehungen.push(BeziehungsObjekt);
			}
		}
		if (!Art.Beziehungssammlungen) {
			Art.Beziehungssammlungen = [];
		}
		Art.Beziehungssammlungen.push(DsEingeschlossenIn);
		//Datensammlungen nach Name sortieren
		Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
		$db.saveDoc(Art);
	}
}

function ergänzeFloraSynonyme() {
	$.when(initiiereImport()).then(function() {
		var Artenliste = frageSql(window.myDB, 'SELECT tblFloraSisf_import.[Synonym von] AS GUID1 FROM tblFloraSisf_import INNER JOIN tblFloraSisf_import AS tblFloraSisf_import_1 ON tblFloraSisf_import.[Synonym von] = tblFloraSisf_import_1.GUID UNION SELECT tblFloraSisf_import.GUID AS GUID1 FROM tblFloraSisf_import WHERE tblFloraSisf_import.[Synonym von] Is Not Null');
		var guidArray = [];
		var a = 0;
		var batch = 150;
		var batchGrösse = 150;
		for (a; a<batch; a++) {
			if (a < Artenliste.length) {
				guidArray.push(Artenliste[a].GUID1);
				if (a === (batch-1)) {
					ergänzeFloraSynonyme_2(guidArray, (a-batchGrösse));
					guidArray = [];
					batch += batchGrösse;
				}
			} else {
				ergänzeFloraSynonyme_2(guidArray, (a-batchGrösse));
				break;
			}
		}
	});
}

function ergänzeFloraSynonyme_2(guidArray, a) {
	setTimeout(function() {
		$db = $.couch.db("artendb");
		$db.view('artendb/all_docs?keys=' + encodeURI(JSON.stringify(guidArray)) + '&include_docs=true', {
			success: function (data) {
				var Art;
				//for (f in data.rows) {
				for (var f = 0; f<data.rows.length; f++) {
					Art = data.rows[f].doc;
					ergänzeFloraSynonymeFuerArt(Art);
				}
			}
		});
	}, a*40);
}

function ergänzeFloraSynonymeFuerArt(Art) {
	var qryFloraSynonyme, Synonym, DsSynonyme, BeziehungsObjekt, Beziehungspartner;
	qryFloraSynonyme = frageSql(window.myDB, 'SELECT tblFloraSisf_import.GUID AS GUID1, tblFloraSisf_import.[Synonym von] AS GUID2, tblFloraSisf_import_1.[Artname vollständig] FROM tblFloraSisf_import INNER JOIN tblFloraSisf_import AS tblFloraSisf_import_1 ON tblFloraSisf_import.[Synonym von] = tblFloraSisf_import_1.GUID WHERE tblFloraSisf_import.GUID="'+Art._id+'" UNION SELECT tblFloraSisf_import.[Synonym von] AS GUID1, tblFloraSisf_import.GUID AS GUID2, tblFloraSisf_import.[Artname vollständig] FROM tblFloraSisf_import WHERE tblFloraSisf_import.[Synonym von] Is Not Null AND tblFloraSisf_import.[Synonym von]="'+Art._id+'" ORDER BY [Artname vollständig]');
	if (qryFloraSynonyme && qryFloraSynonyme.length > 0) {
		//es gibt Synonyme
		for (var k in qryFloraSynonyme) {
			//durch alle Synonyme loopen
			if (qryFloraSynonyme[k].GUID1 === Art._id) {
				DsSynonyme = {};
				DsSynonyme.Name = "SISF Index 2 (2005): synonym";
				DsSynonyme.Typ = "taxonomisch";
				DsSynonyme.Beschreibung = Art.Taxonomie.Beschreibung;
				if (Art.Taxonomie.Datenstand) {
					DsSynonyme.Datenstand = Art.Taxonomie.Datenstand;
				}
				if (Art.Taxonomie.Link) {
					DsSynonyme["Link"] = Art.Taxonomie.Link;
				}
				DsSynonyme["Art der Beziehungen"] = "synonym";
				DsSynonyme.Beziehungen = [];
				//aus dem Synonym ein Objekt bilden
				Beziehungspartner = [];
				Synonym = {};
				Synonym.Gruppe = "Flora";
				Synonym.GUID = qryFloraSynonyme[k].GUID2;
				Synonym.Name = qryFloraSynonyme[k]["Artname vollständig"];
				Beziehungspartner.push(Synonym);
				BeziehungsObjekt = {};
				BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
				DsSynonyme.Beziehungen.push(BeziehungsObjekt);
			}
		}
		if (!Art.Beziehungssammlungen) {
			Art.Beziehungssammlungen = [];
		}
		Art.Beziehungssammlungen.push(DsSynonyme);
		//Datensammlungen nach Name sortieren
		Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
		$db.saveDoc(Art);
	}
}

function importiereFloraDatensammlungen(tblName, Anz) {
	$.when(initiiereImport()).then(function() {
		var DatensammlungDieserArt, anzFelder, anzDs;
		//Medataden laden, wenn nicht schon vorhanden
		if (!window["tblDatensammlungMetadaten" + tblName]) {
			window["tblDatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//Datensätze der Datensammlung abfragen, wenn nicht schon vorhanden
		if (!window["sqlDatensammlung" + tblName]) {
			window["sqlDatensammlung" + tblName] = "SELECT * FROM " + tblName + "_import";
		}
		if (!window["Datensammlung" + tblName]) {
			window["Datensammlung" + tblName] = frageSql(window.myDB, window["sqlDatensammlung" + tblName]);
		}
		anzDs = 0;
		for (var x in window["Datensammlung" + tblName]) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
			if ((anzDs > (Anz*window["tblDatensammlungMetadaten" + tblName][0].DsAnzDs-window["tblDatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["tblDatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//Datensammlung als Objekt gründen
				DatensammlungDieserArt = {};
				DatensammlungDieserArt.Name = window["tblDatensammlungMetadaten" + tblName][0].DsName;
				DatensammlungDieserArt.Beschreibung = window["tblDatensammlungMetadaten" + tblName][0].DsBeschreibung;
				if (window["tblDatensammlungMetadaten" + tblName][0].DsDatenstand) {
					DatensammlungDieserArt.Datenstand = window["tblDatensammlungMetadaten" + tblName][0].DsDatenstand;
				}
				if (window["tblDatensammlungMetadaten" + tblName][0].DsLink) {
					DatensammlungDieserArt["Link"] = window["tblDatensammlungMetadaten" + tblName][0].DsLink;
				}
				DatensammlungDieserArt["importiert von"] = "alexander.gabriel@bd.zh.ch";
				//Daten der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (var y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "NR" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["tblDatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						//aus Synonymen kopierte Infos nicht übernehmen - werden eh angezeigt
						if (y !== "Informationen sind" || (window["Datensammlung" + tblName][x][y].indexOf("kopiert") === -1)) {
							if (window["Datensammlung" + tblName][x][y] === -1) {
								//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
								DatensammlungDieserArt.Daten[y] = true;
							} else {
								//Normalfall
								DatensammlungDieserArt.Daten[y] = window["Datensammlung" + tblName][x][y];
							}
							anzFelder += 1;
						}
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Daten vorkommen. Gibt sonst einen Fehler
				if (anzFelder > 0) {
					//Datenbankabfrage ist langsam. Estern aufrufen, 
					//sonst überholt die for-Schlaufe und DatensammlungDieserArt ist bis zur saveDoc-Ausführung eine andere!
					fuegeDatensammlungZuArt(window["Datensammlung" + tblName][x].GUID, window["tblDatensammlungMetadaten" + tblName][0].DsName, DatensammlungDieserArt);
				}
			}
		}
	});
}

function importiereMoosIndex(Anz) {
	$.when(initiiereImport()).then(function() {
		var Art, anzDs, akzeptierteReferenz;
		if (!window.DatensammlungMetadatenMoose) {
			window.DatensammlungMetadatenMoose = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMooseNism'");
		}
		//Index importieren
		if (!window.tblMooseNism) {
			window.tblMooseNism = frageSql(window.myDB, "SELECT * FROM tblMooseNism_import");
		}
		anzDs = 0;
		for (var x in window.tblMooseNism) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
			if ((anzDs > (Anz*window.DatensammlungMetadatenMoose[0].DsAnzDs-window.DatensammlungMetadatenMoose[0].DsAnzDs)) && (anzDs <= Anz*window.DatensammlungMetadatenMoose[0].DsAnzDs)) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein
				Art._id = window.tblMooseNism[x].GUID;
				Art.Gruppe = window.tblMooseNism[x].Gruppe;
				//Bezeichnet den Typ des Dokuments. Objekt = Art oder Lebensaum. Im Gegensatz zu Beziehung
				Art.Typ = "Objekt";
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art.Taxonomie = {};
				//Datensammlungen und Beziehungssammlungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungssammlungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.DatensammlungMetadatenMoose[0].DsName;
				Art.Taxonomie.Beschreibung = window.DatensammlungMetadatenMoose[0].DsBeschreibung;
				if (window.DatensammlungMetadatenMoose[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.DatensammlungMetadatenMoose[0].DsDatenstand;
				}
				if (window.DatensammlungMetadatenMoose[0].DsLink) {
					Art.Taxonomie["Link"] = window.DatensammlungMetadatenMoose[0].DsLink;
				}
				//Daten der Datensammlung als Objekt gründen
				Art.Taxonomie.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				for (var y in window.tblMooseNism[x]) {
					if (window.tblMooseNism[x][y] !== "" && window.tblMooseNism[x][y] !== null && y !== "Gruppe") {
						if (y === "Akzeptierte Referenz") {
							andereArt = frageSql(window.myDB, "SELECT [Artname vollständig] as Artname FROM tblMooseNism_import where GUID='" + window.tblMooseNism[x][y] + "'");
							var DsSynonyme = {};
							DsSynonyme.Name = "NISM (2010): akzeptierte Referenz";
							DsSynonyme.Typ = "taxonomisch";
							DsSynonyme.Beschreibung = Art.Taxonomie.Beschreibung;
							if (Art.Taxonomie.Datenstand) {
								DsSynonyme.Datenstand = Art.Taxonomie.Datenstand;
							}
							if (Art.Taxonomie.Link) {
								DsSynonyme["Link"] = Art.Taxonomie.Link;
							}
							DsSynonyme["Art der Beziehungen"] = "akzeptierte Referenz";
							//aus dem Synonym ein Objekt bilden
							var Beziehungspartner = [];
							var Synonym = {};
							Synonym.Gruppe = "Moose";
							Synonym.GUID = window.tblMooseNism[x][y];
							Synonym.Name = andereArt[0].Artname;
							Beziehungspartner.push(Synonym);
							var BeziehungsObjekt = {};
							BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
							DsSynonyme.Beziehungen = [];
							DsSynonyme.Beziehungen.push(BeziehungsObjekt);
							if (!Art.Beziehungssammlungen) {
								Art.Beziehungssammlungen = [];
							}
							Art.Beziehungssammlungen.push(DsSynonyme);
							//Datensammlungen nach Name sortieren
							Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
							delete Art.Taxonomie.Daten[y];
						} else if (window.tblMooseNism[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Daten[y] = true;
						} else if (y !== "GUID") {
							Art.Taxonomie.Daten[y] = window.tblMooseNism[x][y];
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
	});
}

function ergänzeMooseSynonyme() {
	$.when(initiiereImport()).then(function() {
		var Artenliste = frageSql(window.myDB, 'SELECT tblMooseNism_import.GUID AS id FROM tblMooseNism_import WHERE tblMooseNism_import.[Akzeptierte Referenz] Is Not Null UNION SELECT tblMooseNism_import.[Akzeptierte Referenz] AS id FROM tblMooseNism_import GROUP BY tblMooseNism_import.[Akzeptierte Referenz] HAVING tblMooseNism_import.[Akzeptierte Referenz] Is Not Null;');
		var guidArray = [];
		var a = 0;
		var batch = 150;
		var batchGrösse = 150;
		for (a; a<batch; a++) {
			if (a < Artenliste.length) {
				guidArray.push(Artenliste[a].id);
				if (a === (batch-1)) {
					ergänzeMooseSynonyme_2(guidArray, (a-batchGrösse));
					guidArray = [];
					batch += batchGrösse;
				}
			} else {
				ergänzeMooseSynonyme_2(guidArray, (a-batchGrösse));
				break;
			}
		}
	});
}

function ergänzeMooseSynonyme_2(guidArray, a) {
	setTimeout(function() {
		$db = $.couch.db("artendb");
		$db.view('artendb/all_docs?keys=' + encodeURI(JSON.stringify(guidArray)) + '&include_docs=true', {
			success: function (data) {
				var Art;
				for (var f = 0; f<data.rows.length; f++) {
					Art = data.rows[f].doc;
					ergänzeMooseSynonymeFuerArt(Art);
				}
			}
		});
	}, a*40);
}

function ergänzeMooseSynonymeFuerArt(Art) {
	var qryMooseSynonyme, Synonym, DsSynonyme, BeziehungsObjekt, Beziehungspartner;
	qryMooseSynonyme = frageSql(window.myDB, 'SELECT tblMooseNism_import.GUID AS GUID1, tblMooseNism_import_1.GUID AS GUID2, tblMooseNism_import_1.[Artname vollständig] FROM tblMooseNism_import INNER JOIN tblMooseNism_import AS tblMooseNism_import_1 ON tblMooseNism_import.[Akzeptierte Referenz] = tblMooseNism_import_1.GUID WHERE tblMooseNism_import.GUID="'+Art._id+'" UNION SELECT tblMooseNism_import.[Akzeptierte Referenz] AS GUID1, tblMooseNism_import.GUID AS GUID2, tblMooseNism_import.[Artname vollständig] FROM tblMooseNism_import GROUP BY tblMooseNism_import.[Akzeptierte Referenz], tblMooseNism_import.GUID, tblMooseNism_import.[Artname vollständig] HAVING tblMooseNism_import.[Akzeptierte Referenz]="'+Art._id+'"');
	if (qryMooseSynonyme && qryMooseSynonyme.length > 0) {
		//es gibt Synonyme
		for (var k in qryMooseSynonyme) {
			//durch alle Synonyme loopen
			if (qryMooseSynonyme[k].GUID1 === Art._id) {
				DsSynonyme = {};
				DsSynonyme.Name = "NISM (2010): synonym";
				DsSynonyme.Typ = "taxonomisch";
				DsSynonyme.Beschreibung = Art.Taxonomie.Beschreibung;
				if (Art.Taxonomie.Datenstand) {
					DsSynonyme.Datenstand = Art.Taxonomie.Datenstand;
				}
				if (Art.Taxonomie.Link) {
					DsSynonyme["Link"] = Art.Taxonomie.Link;
				}
				DsSynonyme["Art der Beziehungen"] = "synonym";
				DsSynonyme.Beziehungen = [];
				//aus dem Synonym ein Objekt bilden
				Beziehungspartner = [];
				Synonym = {};
				Synonym.Gruppe = "Moose";
				Synonym.GUID = qryMooseSynonyme[k].GUID2;
				Synonym.Name = qryMooseSynonyme[k]["Artname vollständig"];
				Beziehungspartner.push(Synonym);
				BeziehungsObjekt = {};
				BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
				DsSynonyme.Beziehungen.push(BeziehungsObjekt);
			}
		}
		if (!Art.Beziehungssammlungen) {
			Art.Beziehungssammlungen = [];
		}
		Art.Beziehungssammlungen.push(DsSynonyme);
		//Datensammlungen nach Name sortieren
		Art.Beziehungssammlungen = sortiereObjektarrayNachName(Art.Beziehungssammlungen);
		$db.saveDoc(Art);
	}
}

function importiereMoosDatensammlungen(tblName, Anz) {
	$.when(initiiereImport()).then(function() {
		var DatensammlungDieserArt, anzFelder, anzDs;
		//Metadaten der Datensmmlung abfragen
		if (!window["DatensammlungMetadaten" + tblName]) {
			window["DatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//Datensätze der Datensammlung abfragen
		if (!window["Datensammlung" + tblName]) {
			window["Datensammlung" + tblName] = frageSql(window.myDB, "SELECT * FROM " + tblName + "_import");
		}
		anzDs = 0;
		for (var x in window["Datensammlung" + tblName]) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//Datensammlung als Objekt gründen
				DatensammlungDieserArt = {};
				DatensammlungDieserArt.Name = window["DatensammlungMetadaten" + tblName][0].DsName;
				DatensammlungDieserArt.Beschreibung = window["DatensammlungMetadaten" + tblName][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName][0].DsDatenstand) {
					DatensammlungDieserArt.Datenstand = window["DatensammlungMetadaten" + tblName][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName][0].DsLink) {
					DatensammlungDieserArt["Link"] = window["DatensammlungMetadaten" + tblName][0].DsLink;
				}
				DatensammlungDieserArt["importiert von"] = "alexander.gabriel@bd.zh.ch";
				//Daten der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (var y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "NR" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["DatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Daten[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Daten[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Daten vorkommen. Gibt sonst einen Fehler
				if (anzFelder > 0) {
					//Datenbankabfrage ist langsam. Estern aufrufen, 
					//sonst überholt die for-Schlaufe und DatensammlungDieserArt ist bis zur saveDoc-Ausführung eine andere!
					fuegeDatensammlungZuArt(window["Datensammlung" + tblName][x].GUID, window["DatensammlungMetadaten" + tblName][0].DsName, DatensammlungDieserArt);
				}
			}
		}
	});
}

function importiereMacromycetesIndex(Anz) {
	$.when(initiiereImport()).then(function() {
		var Art, anzDs;
		if (!window.MacromycetesMetadaten) {
			window.MacromycetesMetadaten = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMacromycetes'");
		}
		//Index importieren
		if (!window.tblMacromycetes) {
			window.tblMacromycetes = frageSql(window.myDB, "SELECT * FROM tblMacromycetes_import");
		}
		anzDs = 0;
		for (var x in window.tblMacromycetes) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
			if ((anzDs > (Anz*window.MacromycetesMetadaten[0].DsAnzDs-window.MacromycetesMetadaten[0].DsAnzDs)) && (anzDs <= Anz*window.MacromycetesMetadaten[0].DsAnzDs)) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein
				Art._id = window.tblMacromycetes[x].GUID;
				Art.Gruppe = window.tblMacromycetes[x].Gruppe;
				//Bezeichnet den Typ des Dokuments. Objekt = Art oder Lebensaum. Im Gegensatz zu Beziehung
				Art.Typ = "Objekt";
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art.Taxonomie = {};
				//Datensammlungen und Beziehungssammlungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungssammlungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.MacromycetesMetadaten[0].DsName;
				Art.Taxonomie.Beschreibung = window.MacromycetesMetadaten[0].DsBeschreibung;
				if (window.MacromycetesMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.MacromycetesMetadaten[0].DsDatenstand;
				}
				if (window.MacromycetesMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.MacromycetesMetadaten[0].DsLink;
				}
				//Daten der Datensammlung als Objekt gründen
				Art.Taxonomie.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				for (var y in window.tblMacromycetes[x]) {
					if (window.tblMacromycetes[x][y] !== "" && window.tblMacromycetes[x][y] !== null && y !== "Gruppe") {
						if (window.tblMacromycetes[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Daten[y] = true;
						} else if (y !== "GUID") {
							Art.Taxonomie.Daten[y] = window.tblMacromycetes[x][y];
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
	});
}

function importiereMacromycetesDatensammlungen(tblName, Anz) {
	$.when(initiiereImport()).then(function() {
		var DatensammlungDieserArt, anzFelder, anzDs;
		//Metadaten der Datensammlung abfragen
		if (!window["DatensammlungMetadaten" + tblName]) {
			window["DatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//Datensätze der Datensammlung abfragen
		if (!window["Datensammlung" + tblName]) {
			window["Datensammlung" + tblName] = frageSql(window.myDB, "SELECT * FROM " + tblName + "_import");
		}
		anzDs = 0;
		for (var x in window["Datensammlung" + tblName]) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//Datensammlung als Objekt gründen
				DatensammlungDieserArt = {};
				DatensammlungDieserArt.Name = window["DatensammlungMetadaten" + tblName][0].DsName;
				DatensammlungDieserArt.Beschreibung = window["DatensammlungMetadaten" + tblName][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName][0].DsDatenstand) {
					DatensammlungDieserArt.Datenstand = window["DatensammlungMetadaten" + tblName][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName][0].DsLink) {
					DatensammlungDieserArt["Link"] = window["DatensammlungMetadaten" + tblName][0].DsLink;
				}
				DatensammlungDieserArt["importiert von"] = "alexander.gabriel@bd.zh.ch";
				//Daten der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (var y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "TaxonId" && y !== "tblMacromycetes.TaxonId" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["DatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Daten[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Daten[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Daten vorkommen. Gibt sonst einen Fehler
				if (anzFelder > 0) {
					//Datenbankabfrage ist langsam. Estern aufrufen, 
					//sonst überholt die for-Schlaufe und DatensammlungDieserArt ist bis zur saveDoc-Ausführung eine andere!
					fuegeDatensammlungZuArt(window["Datensammlung" + tblName][x].GUID, window["DatensammlungMetadaten" + tblName][0].DsName, DatensammlungDieserArt);
				}
			}
		}
	});
}

function importiereFaunaIndex(Anz) {
	$.when(initiiereImport()).then(function() {
		var Art, anzDs;
		if (!window.FaunaMetadaten) {
			window.FaunaMetadaten = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFaunaCscf'");
		}
		//Index importieren
		if (!window.tblFaunaCscf) {
			window.tblFaunaCscf = frageSql(window.myDB, "SELECT * FROM tblFaunaCscf_import");
		}
		anzDs = 0;
		for (var x in window.tblFaunaCscf) {
			//In Häppchen von max. 4000 Datensätzen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 3000er Batches
			if ((anzDs > (Anz*window.FaunaMetadaten[0].DsAnzDs-window.FaunaMetadaten[0].DsAnzDs)) && (anzDs <= Anz*window.FaunaMetadaten[0].DsAnzDs)) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein
				Art._id = window.tblFaunaCscf[x].GUID;
				Art.Gruppe = window.tblFaunaCscf[x].Gruppe;
				//Bezeichnet den Typ des Dokuments. Objekt = Art oder Lebensaum. Im Gegensatz zu Beziehung
				Art.Typ = "Objekt";
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art.Taxonomie = {};
				//Datensammlungen und Beziehungssammlungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungssammlungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.FaunaMetadaten[0].DsName;
				Art.Taxonomie.Beschreibung = window.FaunaMetadaten[0].DsBeschreibung;
				if (window.FaunaMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.FaunaMetadaten[0].DsDatenstand;
				}
				if (window.FaunaMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.FaunaMetadaten[0].DsLink;
				}
				//Daten der Datensammlung als Objekt gründen
				Art.Taxonomie.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				for (var y in window.tblFaunaCscf[x]) {
					if (window.tblFaunaCscf[x][y] !== "" && window.tblFaunaCscf[x][y] !== null && y !== "Gruppe") {
						if (window.tblFaunaCscf[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Daten[y] = true;
						} else if (y !== "GUID") {
							Art.Taxonomie.Daten[y] = window.tblFaunaCscf[x][y];
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
	});
}

function importiereFaunaDatensammlungen(tblName, Anz) {
	$.when(initiiereImport()).then(function() {
		var DatensammlungDieserArt, anzFelder, anzDs;
		//Metadaten der Datensammlung abfragen
		if (!window["DatensammlungMetadaten" + tblName]) {
			window["DatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//Datensätze der Datensammlung abfragen
		if (!window["Datensammlung" + tblName]) {
			window["Datensammlung" + tblName] = frageSql(window.myDB, "SELECT * FROM " + tblName + "_import");
		}
		anzDs = 0;
		for (var x in window["Datensammlung" + tblName]) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 3000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//Datensammlung als Objekt gründen
				DatensammlungDieserArt = {};
				DatensammlungDieserArt.Name = window["DatensammlungMetadaten" + tblName][0].DsName;
				DatensammlungDieserArt.Beschreibung = window["DatensammlungMetadaten" + tblName][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName][0].DsDatenstand) {
					DatensammlungDieserArt.Datenstand = window["DatensammlungMetadaten" + tblName][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName][0].DsLink) {
					DatensammlungDieserArt["Link"] = window["DatensammlungMetadaten" + tblName][0].DsLink;
				}
				if (window["DatensammlungMetadaten" + tblName][0].zusammenfassend == "true") {
					DatensammlungDieserArt.zusammenfassend = true;
				}
				DatensammlungDieserArt["importiert von"] = "alexander.gabriel@bd.zh.ch";
				//Daten der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (var y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null) {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Daten[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Daten[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Daten vorkommen. Gibt sonst einen Fehler
				if (anzFelder > 0) {
					//Datenbankabfrage ist langsam. Estern aufrufen, 
					//sonst überholt die for-Schlaufe und DatensammlungDieserArt ist bis zur saveDoc-Ausführung eine andere!
					fuegeDatensammlungZuArt(window["Datensammlung" + tblName][x].GUID, window["DatensammlungMetadaten" + tblName][0].DsName, DatensammlungDieserArt);
				}
			}
		}
	});
}

function importiereLrIndex(Anz) {
	$.when(initiiereImport()).then(function() {
		var Art, anzDs, DsName;
		//Metadaten abfragen
		if (!window.LrMetadaten) {
			window.LrMetadaten = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'LR'");
		}
		//Index importieren
		if (!window.tblLr) {
			window.tblLr = frageSql(window.myDB, "SELECT * FROM LR_import");
		}
		anzDs = 0;
		for (var x in window.tblLr) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
			if ((anzDs > (Anz*window.LrMetadaten[0].DsAnzDs-window.LrMetadaten[0].DsAnzDs)) && (anzDs <= Anz*window.LrMetadaten[0].DsAnzDs)) {
				//Art als Objekt gründen
				Art = {};
				//_id soll GUID sein
				Art._id = window.tblLr[x].GUID;
				DsName = window.tblLr[x].Taxonomie;
				Art.Gruppe = "Lebensräume";
				//Bezeichnet den Typ des Dokuments. Objekt = Art oder Lebensaum. Im Gegensatz zu Beziehung
				Art.Typ = "Objekt";
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art.Taxonomie = {};
				//Datensammlungen und Beziehungssammlungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungssammlungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = DsName;
				if (Art.Taxonomie.Beschreibung) {
					Art.Taxonomie.Beschreibung = window.LrMetadaten[0].DsBeschreibung;
				}
				if (window.LrMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.LrMetadaten[0].DsDatenstand;
				}
				if (window.LrMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.LrMetadaten[0].DsLink;
				}
				//Daten der Datensammlung als Objekt gründen
				Art.Taxonomie.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten. Gruppe ist schon eingefügt
				for (var y in window.tblLr[x]) {
					if (window.tblLr[x][y] !== "" && window.tblLr[x][y] !== null && y !== "Gruppe") {
						if (window.tblLr[x][y] === -1) {
							//Access wandelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Daten[y] = true;
						} else if (y === "Einheit-Nrn FNS von" || y === "Einheit-Nrn FNS bis") {
							//access hat irgendwie aus Zahlen Zeichen gemacht
							Art.Taxonomie.Daten[y] = parseInt(window.tblLr[x][y], 10);
						} else if (y === "Beschreibung" && window.tblLr[x][y]) {
							//komische Inhalte ersetzen
							Art.Taxonomie.Daten[y] = window.tblLr[x][y]
								.replace("http://www.wsl.ch/floraindicativa/index_DE#http://www.wsl.ch/floraindicativa/index_DE#", "http://www.wsl.ch/floraindicativa/index_DE")
								.replace("http://www.cscf.ch/webdav/site/cscf/shared/documents/vademecum.pdf#http://www.cscf.ch/webdav/site/cscf/shared/documents/vademecum.pdf#", "http://www.cscf.ch/webdav/site/cscf/shared/documents/vademecum.pdf")
								.replace("#http://www.bafu.admin.ch/gis/02911/07403/index.html?lang=de#", "")
								.replace("#G:\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\Wiesenkartierschlüssel Aargau 2004#", "")
								.replace("#G:\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\TS_Oberland_91#", "")
								.replace("#G:\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\Feuchtgebietskartierung_7677\\1978InventarFeuchtgebieteBerichtBur", "")
								.replace("#G:\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\Feuchtgebietskartierung_7677\\1978InventarFeuchtgebieteBerichtBur", "")
								.replace("#G:\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\Feuchtgebietskartierung_7677\\1978InventarFeuchtgebieteBerichtBurnandZüst.pdf#", "")
								.replace("#G:\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\Bachtel_08_Schlüssel.pdf#", "")
								.replace("#\\\\sbd3201\\data$\\aln\\FNS\\_Migration\\BereichA\\Alex\\Biotope\\Kartierschlüssel\\Bachtel_08_Schlüssel.pdf#", "")
								.replace("#http://www.bafu.admin.ch/gis/02911/index.html?lang=de#", "")
								.replace("ART - Definitionen zu den Artlisten#http://www.art.admin.ch/themen/00563/00677/00679/index.html?lang=de#sprungmarke0_9", "ART - Definitionen zu den Artlisten: http://www.art.admin.ch/themen/00563/00677/00679/index.html?lang=de#sprungmarke0_9")
								.replace("#http://Ablage: 5.202 [4] N, Bibl. Naturschutz [4]#", "")
								.replace(/#/g, "");
						} else if (y !== "GUID") {
							Art.Taxonomie.Daten[y] = window.tblLr[x][y];
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
	});
}

function aktualisiereLrHierarchie() {
	$.when(initiiereImport()).then(function() {
		//mit der mdb verbinden
		$db = $.couch.db("artendb");
		$db.view('artendb/lr?include_docs=true', {
			success: function (data) {
				for (var i in data.rows) {
					var LR, Hierarchie, Hierarchie2;
					LR = data.rows[i].doc;
					if (LR.Taxonomie.Daten.Parent && typeof LR.Taxonomie.Daten.Parent === "string") {
						Hierarchie1 = [];
						LR.Taxonomie.Daten.Hierarchie = ergänzeParentZuHierarchie(data, LR._id, Hierarchie1);
						$db.saveDoc(LR);
					}
				}
			}
		});
	});
}

//Baut den Hierarchiepfad für einen Lebensraum auf
//das erste Element - der Lebensraum selbst - wird mit der Variable "Hierarchie" übergeben
//ruft sich selbst rekursiv auf, bis das oberste Hierarchieelement erreicht ist
function ergänzeParentZuHierarchie(Lebensräume, parentGUID, Hierarchie) {
	for (var i in Lebensräume.rows) {
		var LR, parentObjekt, hierarchieErgänzt;
		LR = Lebensräume.rows[i].doc;
		if (LR._id === parentGUID) {
			parentObjekt = {};
			if (LR.Taxonomie.Daten.Label) {
				parentObjekt.Name = LR.Taxonomie.Daten.Label + ": " + LR.Taxonomie.Daten.Einheit;
			} else {
				parentObjekt.Name = LR.Taxonomie.Daten.Einheit;
			}
			parentObjekt.GUID = LR._id;
			Hierarchie.push(parentObjekt);
			if (LR.Taxonomie.Daten.Parent !== LR._id) {
				//die Hierarchie ist noch nicht zu Ende - weitermachen
				hierarchieErgänzt = ergänzeParentZuHierarchie(Lebensräume, LR.Taxonomie.Daten.Parent, Hierarchie);
				return Hierarchie;
			} else {
				//jetzt ist die Hierarchie vollständig
				//sie ist aber verkehrt - umkehren
				return Hierarchie.reverse();
			}
		}
	}
}

//Macht für alle Lebensräume mit Parent aus dem im Feld Parent enthaltenen GUID 
//ein Objekt mit GUID und Name = Einheit
function aktualisiereLrParent() {
	$.when(initiiereImport()).then(function() {
		var qryEinheiten;
		qryEinheiten = frageSql(window.myDB, "SELECT GUID, Einheit FROM LR_import");
		$db = $.couch.db("artendb");
		$db.view('artendb/lr?include_docs=true', {
			success: function (data) {
				for (var i in data.rows) {
					var LR, Parent;
					LR = data.rows[i].doc;
					if (LR.Taxonomie.Daten.Parent) {
						for (var k in qryEinheiten) {
							if (qryEinheiten[k].GUID === LR.Taxonomie.Daten.Parent) {
								Parent = {};
								Parent.GUID = qryEinheiten[k].GUID;
								Parent.Name = qryEinheiten[k].Einheit;
								break;
							}
						}
						LR.Taxonomie.Daten.Parent = Parent;
						$db.saveDoc(LR);
					}
				}
			}
		});
	});
}

function importiereLrDatensammlungen(tblName, Anz) {
	$.when(initiiereImport()).then(function() {
		var DatensammlungDieserArt, anzFelder, anzDs;
		if (!window["DatensammlungMetadaten" + tblName]) {
			window["DatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//Datensätze der Datensammlung abfragen
		if (!window["Datensammlung" + tblName]) {
			window["Datensammlung" + tblName] = frageSql(window.myDB, "SELECT * FROM " + tblName + "_import");
		}
		anzDs = 0;
		for (var x in window["Datensammlung" + tblName]) {
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//Datensammlung als Objekt gründen
				DatensammlungDieserArt = {};
				DatensammlungDieserArt.Name = window["DatensammlungMetadaten" + tblName][0].DsName;
				if (window["DatensammlungMetadaten" + tblName][0].DsBeschreibung) {
					DatensammlungDieserArt.Beschreibung = window["DatensammlungMetadaten" + tblName][0].DsBeschreibung;
				}
				if (window["DatensammlungMetadaten" + tblName][0].DsDatenstand) {
					DatensammlungDieserArt.Datenstand = window["DatensammlungMetadaten" + tblName][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName][0].DsLink) {
					DatensammlungDieserArt["Link"] = window["DatensammlungMetadaten" + tblName][0].DsLink;
				}
				DatensammlungDieserArt["importiert von"] = "alexander.gabriel@bd.zh.ch";
				//Daten der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Daten = {};
				//Daten anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (var y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "Id" && y !== "LR.Id" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["DatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Daten[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Daten[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Daten vorkommen. Gibt sonst einen Fehler
				if (anzFelder > 0) {
					//Datenbankabfrage ist langsam. Extern aufrufen, 
					//sonst überholt die for-Schlaufe und DatensammlungDieserArt ist bis zur saveDoc-Ausführung eine andere!
					fuegeDatensammlungZuArt(window["Datensammlung" + tblName][x].GUID, window["DatensammlungMetadaten" + tblName][0].DsName, DatensammlungDieserArt);
				}
			}
		}
	});
}

//fügt der Art eine Datensammlung hinzu
//wenn dieselbe schon vorkommt, wird sie überschrieben
function fuegeDatensammlungZuArt(GUID, DsName, DatensammlungDieserArt) {
	$db = $.couch.db("artendb");
	$db.openDoc(GUID, {
		success: function (doc) {
			//Datensammlung anfügen
			if (!doc.Datensammlungen) {
				doc.Datensammlungen = [];
			}
			doc.Datensammlungen.push(DatensammlungDieserArt);
			//Datensammlungen nach Name sortieren
			doc.Datensammlungen = sortiereObjektarrayNachName(doc.Datensammlungen);
			//in artendb speichern
			$db.saveDoc(doc);
		}
	});

	//alternative Variante mit update-handler. hat nicht funktioniert
	/*$.ajax({
		type: "POST",
		//url: "../../_bulk_docs",
		url: "http://127.0.0.1:5984/artendb/_design/artendb/_update/eigenschaft_objekt/" + GUID + "?field=" + DsName + "&value='" + JSON.stringify(DatensammlungDieserArt) + "'",
		contentType: "application/json"
		//data: JSON.stringify(ObjektMitDeleteListe)
	}).done(function() {
		//dokumenteVonDatensatzobjektGelöscht.resolve();
	});*/
}








function importiereFloraFaunaBeziehungen(tblName, Anz) {
	//Alle Arten der Beziehungssammlungen aus Access abfragen
	//durch alle Arten der Beziehungssammlungen aus Access zirkeln
	//darin: durch alle Beziehungen zirkeln
	//wenn die Beziehung die Art enthält, Beziehung ergänzen
	//ein mal in die couch schreiben. SONST GIBT ES KONFLIKTE
	$.when(initiiereImport()).then(function() {
		var anzDs;
		//wenn noch nicht vorhanden...
		if (!window["DatensammlungMetadaten" + tblName]) {
			//Informationen zur Datensammlung holen
			window["DatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//wenn noch nicht vorhanden...
		if (!window[tblName]) {
			//Beziehungssammlungen holen
			window[tblName] = frageSql(window.myDB, "SELECT * FROM " + tblName + "_import");
		}
		//wenn noch nicht vorhanden...
		if (!window[tblName + "_artenliste"]) {
			//liste aller Arten holen, von denen Beziehungssammlungen importiert werden sollen
			window[tblName + "_artenliste"] = frageSql(window.myDB, 'SELECT ' + tblName + '_import.[Flora GUID] AS [GUID] FROM ' + tblName + '_import UNION SELECT ' + tblName + '_import.[Fauna GUID] AS [GUID] from ' + tblName + '_import');
		}
		anzDs = 0;
		for (var f in window[tblName + "_artenliste"]) {
			//Artenliste in Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Häppchen (in Access-DB definiert)
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//jetzt die Beziehungssammlungen dieser Art holen
				importiereFloraFaunaBeziehungenFuerArt(window[tblName + "_artenliste"][f].GUID, tblName);
			}
			if (anzDs === Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs || anzDs === window[tblName + "_artenliste"].length) {
				console.log("Import von " + tblName + " fertig: anzDs = " + anzDs);
			}
		}
	});
}

//importiert die Flora-Fauna-Beziehungssammlungen eine Art
//benötigt deren GUID und den Tabellennahmen
function importiereFloraFaunaBeziehungenFuerArt (GUID, tblName) {
	var Feldnamen = ["Imago", "Larve", "Ei"];
	var Fauna;
	var Flora;
	var Beziehung;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = window["DatensammlungMetadaten" + tblName][0].DsName;
	if (window["DatensammlungMetadaten" + tblName][0].DsBeschreibung) {
		Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName][0].DsBeschreibung;
	}
	if (window["DatensammlungMetadaten" + tblName][0].DsDatenstand) {
		Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName][0].DsDatenstand;
	}
	if (window["DatensammlungMetadaten" + tblName][0].DsLink) {
		Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName][0].DsLink;
	}
	if (tblName === "tblFloraFaunaBezEbert") {
		Datensammlung["Art der Beziehungen"] = "Beziehungen zwischen Schmetterlingen und Pflanzenarten";
	} else if (tblName === "tblFloraFaunaBezWestrich") {
		Datensammlung["Art der Beziehungen"] = "Beziehungen zwischen Wildbienen und Pflanzenarten";
	}
	Datensammlung["importiert von"] = "alexander.gabriel@bd.zh.ch";
	//den Array für die Beziehungen schaffen
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < window[tblName].length; x++) {
		if (window[tblName][x]["Flora GUID"] === GUID || window[tblName][x]["Fauna GUID"] === GUID) {
			//Beziehung enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			if (window[tblName][x]["Flora GUID"] === GUID) {
				//Art ist Flora. Beziehungspartner aus Fauna speichern
				Fauna = {};
				Fauna.Gruppe = "Fauna";
				Fauna.Name = window[tblName][x]["Fauna Name"];
				Fauna.GUID = window[tblName][x]["Fauna GUID"];
				Beziehung.Beziehungspartner.push(Fauna);
			} else if (window[tblName][x]["Fauna GUID"] === GUID) {
				//Art ist Fauna. Beziehungspartner aus Flora speichern
				Flora = {};
				Flora.Gruppe = "Flora";
				Flora.Name = window[tblName][x]["Flora Name"];
				Flora.GUID = window[tblName][x]["Flora GUID"];
				Beziehung.Beziehungspartner.push(Flora);
			}
			//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
			$.each(Feldnamen, function(index, value) {
				if (window[tblName][x][value] !== "" && window[tblName][x][value] !== null) {
					Beziehung[value] = window[tblName][x][value];
				}
			});
			//die Beziehung anfügen
			Datensammlung.Beziehungen.push(Beziehung);
		}
	}
	if (Datensammlung.Beziehungen.length > 0) {
		//die Beziehungen nach Objektnamen sortieren
		Datensammlung.Beziehungen = sortiereBeziehungenNachName(Datensammlung.Beziehungen);
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (art) {
				//Datensammlung der Art zufügen
				if (!art.Beziehungssammlungen) {
					art.Beziehungssammlungen = [];
				}
				art.Beziehungssammlungen.push(Datensammlung);
				//Datensammlungen nach Name sortieren
				art.Beziehungssammlungen = sortiereObjektarrayNachName(art.Beziehungssammlungen);
				$db.saveDoc(art);
			}
		});
	}
}

function importiereLrFaunaBeziehungen(tblName, beziehung_nr) {
	//Alle Beziehungen aus Access abfragen
	//Beziehungen pro Art zusammenfassen
	//Funktion aufrufen, welche die Art öffnet und die Beziehungen aktualisiert
	$.when(initiiereImport()).then(function() {
		//Informationen zur Datensammlung holen
		var metadaten = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		//Beziehungssammlungen holen
		var beziehungen = frageSql(window.myDB, "SELECT * FROM tblLrFaunaBez_import WHERE DsTabelle='" + metadaten[0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		//Beziehungen pro Objekt zusammenfassen
		var bezProFaunaArt = _.groupBy(beziehungen, function(bez){return bez["Fauna GUID"];});
		var bezProLr = _.groupBy(beziehungen, function(bez){return bez["LR GUID"];});
		//Beziehungen pro Objekt importieren lassen
		$.each(bezProFaunaArt, function(key, value){
			importiereLrFaunaBeziehungenFuerArt(key, metadaten, value);
		});
		$.each(bezProLr, function(key, value){
			importiereLrFaunaBeziehungenFuerArt(key, metadaten, value);
		});
	});
}

//importiert die LR-Fauna-Beziehungssammlungen eines Objekts
//benötigt dessen GUID, beziehungen und metadaten
function importiereLrFaunaBeziehungenFuerArt (GUID, metadaten, beziehungen) {
	var Feldnamen = ["Wert für die Beziehung", "Bemerkungen"];
	var LR;
	var Fauna;
	var Beziehung;
	var artDerBeziehungExistiertSchon;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = metadaten[0].DsName + ": " + metadaten[0].Beziehung;
	if (metadaten[0].DsBeschreibung) {
		Datensammlung.Beschreibung = metadaten[0].DsBeschreibung;
	}
	if (metadaten[0].DsDatenstand) {
		Datensammlung.Datenstand = metadaten[0].DsDatenstand;
	}
	if (metadaten[0].DsLink) {
		Datensammlung["Link"] = metadaten[0].DsLink;
	}
	//Art der Beziehung soll eine Eigenschaft der Datensammlung sein, nicht der Beziehung
	Datensammlung["Art der Beziehungen"] = beziehungen[0]["Art der Beziehung"];
	Datensammlung["importiert von"] = "alexander.gabriel@bd.zh.ch";
	//den Array für die Beziehungen schaffen
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < beziehungen.length; x++) {
		if (beziehungen[x]["Fauna GUID"] === GUID || beziehungen[x]["LR GUID"] === GUID) {
			//Das ist der richtige Typ Beziehung und sie enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			if (beziehungen[x]["LR GUID"] === GUID) {
				//Art ist LR. Beziehungspartner aus Fauna speichern
				Fauna = {};
				Fauna.Gruppe = "Fauna";
				Fauna.Name = beziehungen[x]["Fauna Name"];
				Fauna.GUID = beziehungen[x]["Fauna GUID"];
				Beziehung.Beziehungspartner.push(Fauna);
			} else if (beziehungen[x]["Fauna GUID"] === GUID) {
				//Art ist Fauna. Beziehungspartner aus LR speichern
				LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = beziehungen[x]["LR Taxonomie"];
				LR.Name = beziehungen[x]["LR Name"];
				LR.GUID = beziehungen[x]["LR GUID"];
				Beziehung.Beziehungspartner.push(LR);
			}
			//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
			$.each(Feldnamen, function(index, value) {
				//Leerwerte ausschliessen, aber nicht die 0
				if (beziehungen[x][value] !== "" && beziehungen[x][value] !== null) {
					//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
					if (metadaten[0].DsTabelle === "tblFaunaFnsApFm") {
						Beziehung.Biotopbindung = beziehungen[x][value];
					} else {
						Beziehung[value] = beziehungen[x][value];
					}
				}
			});
			//die Beziehung anfügen
			Datensammlung.Beziehungen.push(Beziehung);
		}
	}
	if (Datensammlung.Beziehungen.length > 0) {
		//nur, wenn Beziehungen existieren!
		//die Beziehungen nach Objektnamen sortieren
		Datensammlung.Beziehungen = sortiereBeziehungenNachName(Datensammlung.Beziehungen);
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (art) {
				//Datensammlung der Art zufügen
				if (!art.Beziehungssammlungen) {
					art.Beziehungssammlungen = [];
					art.Beziehungssammlungen.push(Datensammlung);
				} else {
					artDerBeziehungExistiertSchon = false;
					//kontrollieren, ob diese Art von Beziehungssammlungen schon existiert
					for (var i in art.Beziehungssammlungen) {
						if (art.Beziehungssammlungen[i].Name === Datensammlung.Name) {
							artDerBeziehungExistiertSchon = true;
							//Beziehungssammlungen in vorhandener Datensammlung ergänzen
							for (var q=0; q<Datensammlung.Beziehungen.length; q++) {
								art.Beziehungssammlungen[i].Beziehungen.push(Datensammlung.Beziehungen[q]);
							}
							//und neu sortieren
							art.Beziehungssammlungen[i].Beziehungen = sortiereBeziehungenNachName(art.Beziehungssammlungen[i].Beziehungen);
						}
					}
					if (!artDerBeziehungExistiertSchon) {
						//Datensammlung sammt Beziehung ergänzen
						art.Beziehungssammlungen.push(Datensammlung);
					}
				}
				//Datensammlungen nach Name sortieren
				art.Beziehungssammlungen = sortiereObjektarrayNachName(art.Beziehungssammlungen);
				$db.saveDoc(art);
			}
		});
	}
}

function importiereLrFloraBeziehungen(tblName, beziehung_nr) {
	//Alle Arten der Beziehungssammlungen aus Access abfragen
	//durch alle Arten der Beziehungssammlungen aus Access zirkeln
	//darin: durch alle Beziehungen zirkeln
	//wenn die Beziehung die Art enthält, Beziehung ergänzen
	//ein mal in die couch schreiben. SONST GIBT ES KONFLIKTE
	$.when(initiiereImport()).then(function() {
		//wenn noch nicht vorhanden...
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			//Informationen zur Datensammlung holen
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		}
		var metadaten = window["DatensammlungMetadaten" + tblName + beziehung_nr];
		//Anzahl Beziehungen ermitteln
		var anzBezQuery = frageSql(window.myDB, "SELECT COUNT(tblLrFloraBez_import.GUID) AS anzBez FROM tblLrFloraBez_import WHERE DsTabelle='" + metadaten[0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		var anzBez = anzBezQuery[0].anzBez;
		//console.log('anzBez = ' + anzBez);
		//console.log('tblName = ' + tblName);
		//console.log('beziehung_nr = ' + beziehung_nr);
		var beziehungen = frageSql(window.myDB, "SELECT * FROM tblLrFloraBez_import WHERE DsTabelle='" + tblName + "' AND BeziehungNr=" + beziehung_nr);
		//console.log('beziehungen = ' + JSON.stringify(beziehungen));
		//Beziehungen pro Objekt zusammenfassen
		var bezProFloraArt = _.groupBy(beziehungen, function(bez){return bez["Flora GUID"];});
		//console.log('bezProFloraArt erstellt');
		var bezProLr = _.groupBy(beziehungen, function(bez){return bez["LR GUID"];});
		//console.log('bezProLr erstellt');
		//Objekt mit allen Beziehungen bilden
		var bezProObjekt = jQuery.extend(true, {}, bezProFloraArt);
		bezProObjekt = _.extend(bezProObjekt, bezProLr);
		//console.log('bezProObjekt erstellt');
		console.log('_.size(bezProObjekt) = ' + _.size(bezProObjekt));
		//Array mit allen GUID's bilden
		var bezGuidArray = _.keys(bezProObjekt);
		//console.log('bezGuidArray.length = ' + bezGuidArray.length);
		//console.log('bezGuidArray[0] = ' + bezGuidArray[0]);

		var bezProObjektTemp = {};
		var bezGuidTemp = [];
		var a = 0;
		var batch = 100;
		var batchGrösse = 100;
		for (a; a<batch; a++) {
			if (bezGuidArray.length > 0) {
				bezGuidTemp.push(bezGuidArray.splice(0,1));
				if (a === (batch-1)) {
					//batch ist fertig
					//die den GUIDs in bezGuidTemp entsprechenden Arten aus bezProObjekt herauslösen
					bezProObjektTemp = _.pick(bezProObjekt, bezGuidTemp);
					//bezProObjekt = _.omit(bezProObjekt, bezGuidTemp);
					//console.log('_.size(bezProObjektTemp) = ' + _.size(bezProObjektTemp));
					//console.log('_.size(bezProObjekt) = ' + _.size(bezProObjekt));
					console.log('bezGuidArray.length = ' + bezGuidArray.length);
					console.log('a = ' + a);
					console.log('batch = ' + batch);
					importiereLrFloraBeziehungen_2(bezProObjektTemp, metadaten, batchGrösse, batch, a);
					bezProObjektTemp = {};
					bezGuidTemp = [];
					batch += batchGrösse;
				}
			} else {
				//wir sind beim letzten Objekt angelangt
				//die den GUIDs in bezGuidTemp entsprechenden Arten aus bezProObjekt herauslösen
				bezProObjektTemp = _.pick(bezProObjekt, bezGuidTemp);
				bezProObjekt = _.omit(bezProObjekt, bezGuidTemp);
				//console.log('_.size(bezProObjekt) = ' + _.size(bezProObjekt));
				console.log('bezGuidArray.length = ' + bezGuidArray.length);
				importiereLrFloraBeziehungen_2(bezProObjektTemp, metadaten, batchGrösse, batch);
				break;
			}
		}
	});
}

function importiereLrFloraBeziehungen_2(bezProObjektTemp, metadaten, batchGrösse, batch, a) {
	var b = batch-batchGrösse+1;
	//console.log('b = ' + b);
	setTimeout(function(){
		importiereLrFloraBeziehungen_3(bezProObjektTemp, metadaten, a);
	}, b*30);
}

function importiereLrFloraBeziehungen_3(bezProObjektTemp, metadaten, a) {
	var guidArray = _.map(bezProObjektTemp, function(value, key, list){ return key; });
	$db = $.couch.db("artendb");
	$db.view('artendb/all_docs?keys=' + encodeURI(JSON.stringify(guidArray)) + '&include_docs=true', {
		success: function (data) {
			var Objekt;
			for (var f = 0; f<data.rows.length; f++) {
				Objekt = data.rows[f].doc;
				importiereLrFloraBeziehungenFuerObjekt(Objekt, metadaten, bezProObjektTemp[Objekt._id]);
			}
		}
	});
}

//importiert die LR-Flora-Beziehungssammlungen einer Art
//benötigt deren GUID und den Tabellennahmen und die Beziehungs-Nr
function importiereLrFloraBeziehungenFuerObjekt (objekt, metadaten, beziehungen) {
	var Feldnamen = ["Wert für die Beziehung", "Bemerkungen"];
	var LR;
	var Flora;
	var Beziehungen;
	var Beziehung;
	var anzBeziehungen;
	var artDerBeziehungExistiertSchon;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = metadaten[0].DsName + ": " + metadaten[0].Beziehung;
	if (metadaten[0].DsBeschreibung) {
		Datensammlung.Beschreibung = metadaten[0].DsBeschreibung;
	}
	if (metadaten[0].DsDatenstand) {
		Datensammlung.Datenstand = metadaten[0].DsDatenstand;
	}
	if (metadaten[0].DsLink) {
		Datensammlung["Link"] = metadaten[0].DsLink;
	}
	//Art der Beziehung soll eine Eigenschaft der Datensammlung sein, nicht der Beziehungen
	Datensammlung["Art der Beziehungen"] = beziehungen[0]["Art der Beziehung"];
	Datensammlung["importiert von"] = "alexander.gabriel@bd.zh.ch";
	//den Array für die Beziehungen schaffen - erst jetzt, damit es unter "Art der Beziehungen" liegt
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < beziehungen.length; x++) {
		if (beziehungen[x]["Flora GUID"] === objekt._id || beziehungen[x]["LR GUID"] === objekt._id) {
			//Das ist der richtige Typ Beziehung und sie enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			if (beziehungen[x]["LR GUID"] === objekt._id) {
				//Art ist LR. Beziehungspartner aus Flora speichern
				Flora = {};
				Flora.Gruppe = "Flora";
				Flora.Name = beziehungen[x]["Flora Name"];
				Flora.GUID = beziehungen[x]["Flora GUID"];
				Beziehung.Beziehungspartner.push(Flora);
			} else if (beziehungen[x]["Flora GUID"] === objekt._id) {
				//Art ist Flora. Beziehungspartner aus LR speichern
				LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = beziehungen[x]["LR Taxonomie"];
				LR.Name = beziehungen[x]["LR Name"];
				LR.GUID = beziehungen[x]["LR GUID"];
				Beziehung.Beziehungspartner.push(LR);
			}
			//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
			$.each(Feldnamen, function(index, value) {
				//Leerwerte ausschliessen, aber nicht die 0
				if (beziehungen[x][value] !== "" && beziehungen[x][value] !== null) {
					//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
					if (metadaten[0].DsTabelle === "tblFloraFnsApFm") {
						Beziehung.Biotopbindung = beziehungen[x][value];
					} else {
						Beziehung[value] = beziehungen[x][value];
					}
				}
			});
			//die Beziehung anfügen
			Datensammlung.Beziehungen.push(Beziehung);
		}
	}
	if (Datensammlung.Beziehungen.length > 0) {
		//nur, wenn Beziehungen existieren!
		//die Beziehungen nach Objektnamen sortieren
		Datensammlung.Beziehungen = sortiereBeziehungenNachName(Datensammlung.Beziehungen);
		//jetzt das Objekt um diese Beziehung ergänzen
		//Datensammlung des Objekts zufügen
		if (!objekt.Beziehungssammlungen) {
			objekt.Beziehungssammlungen = [];
			objekt.Beziehungssammlungen.push(Datensammlung);
		} else {
			artDerBeziehungExistiertSchon = false;
			//kontrollieren, ob diese Art von Beziehungssammlungen schon existiert
			for (var i in objekt.Beziehungssammlungen) {
				if (objekt.Beziehungssammlungen[i].Name === Datensammlung.Name) {
					artDerBeziehungExistiertSchon = true;
					//Beziehungssammlungen in vorhandener Datensammlung ergänzen
					for (var q=0; q<Datensammlung.Beziehungen.length; q++) {
						if (!containsObject(Datensammlung.Beziehungen[q], objekt.Beziehungssammlungen[i].Beziehungen)) {
							//nur hinzufügen, wenn diese Beziehung nicht schon drin ist
							objekt.Beziehungssammlungen[i].Beziehungen.push(Datensammlung.Beziehungen[q]);
						}
					}
					//und neu sortieren
					objekt.Beziehungssammlungen[i].Beziehungen = sortiereBeziehungenNachName(objekt.Beziehungssammlungen[i].Beziehungen);
				}
			}
			if (!artDerBeziehungExistiertSchon) {
				//Datensammlung sammt Beziehung ergänzen
				objekt.Beziehungssammlungen.push(Datensammlung);
			}
		}
		if (objekt.Beziehungssammlungen.length > 0) {
			//Datensammlungen nach Name sortieren
			objekt.Beziehungssammlungen = sortiereObjektarrayNachName(objekt.Beziehungssammlungen);
		}
		$db = $.couch.db("artendb");
		$db.saveDoc(objekt);
	}
}

function importiereLrMooseBeziehungen(tblName, beziehung_nr) {
	//Alle Beziehungen aus Access abfragen
	//Beziehungen pro Art zusammenfassen
	//Funktion aufrufen, welche die Art öffnet und die Beziehungen aktualisiert
	$.when(initiiereImport()).then(function() {
		//Informationen zur Datensammlung holen
		var metadaten = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		//Beziehungen holen
		var beziehungen = frageSql(window.myDB, "SELECT * FROM tblLrMooseBez_import WHERE DsTabelle='" + metadaten[0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		console.log('window[tblLrMooseBez' + tblName + beziehung_nr + '].length = ' + beziehungen.length);
		//Beziehungen pro Objekt zusammenfassen
		var bezProMoosArt = _.groupBy(beziehungen, function(bez){return bez["Moos GUID"];});
		var bezProLr = _.groupBy(beziehungen, function(bez){return bez["LR GUID"];});
		//Beziehungen pro Objekt importieren lassen
		$.each(bezProMoosArt, function(key, value){
			importiereLrMooseBeziehungenFuerArt(key, metadaten, value);
		});
		$.each(bezProLr, function(key, value){
			importiereLrMooseBeziehungenFuerArt(key, metadaten, value);
		});
	});
}

//importiert die LR-Moose-Beziehungen eines Objekts
//benötigt dessen GUID, beziehungen und metadaten
function importiereLrMooseBeziehungenFuerArt (GUID, metadaten, beziehungen) {
	var Feldnamen = ["Wert für die Beziehung", "Bemerkungen"];
	var LR;
	var Moose;
	var Beziehung;
	var artDerBeziehungExistiertSchon;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = metadaten[0].DsName + ": " + metadaten[0].Beziehung;
	if (metadaten[0].DsBeschreibung) {
		Datensammlung.Beschreibung = metadaten[0].DsBeschreibung;
	}
	if (metadaten[0].DsDatenstand) {
		Datensammlung.Datenstand = metadaten[0].DsDatenstand;
	}
	if (metadaten[0].DsLink) {
		Datensammlung["Link"] = metadaten[0].DsLink;
	}
	//Art der Beziehung soll eine Eigenschaft der Datensammlung sein, nicht der Beziehungen
	Datensammlung["Art der Beziehungen"] = beziehungen[0]["Art der Beziehung"];
	Datensammlung["importiert von"] = "alexander.gabriel@bd.zh.ch";
	//den Array für die Beziehungen schaffen
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < beziehungen.length; x++) {
		if (beziehungen[x]["Moos GUID"] === GUID || beziehungen[x]["LR GUID"] === GUID) {
			//Das ist der richtige Typ Beziehung und sie enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			if (beziehungen[x]["LR GUID"] === GUID) {
				//Art ist LR. Beziehungspartner aus Moose speichern
				Moos = {};
				Moos.Gruppe = "Moose";
				Moos.Name = beziehungen[x]["Moos Name"];
				Moos.GUID = beziehungen[x]["Moos GUID"];
				Beziehung.Beziehungspartner.push(Moos);
			} else if (beziehungen[x]["Moos GUID"] === GUID) {
				//Art ist Moose. Beziehungspartner aus LR speichern
				LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = beziehungen[x]["LR Taxonomie"];
				LR.Name = beziehungen[x]["LR Name"];
				LR.GUID = beziehungen[x]["LR GUID"];
				Beziehung.Beziehungspartner.push(LR);
			}
			//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
			$.each(Feldnamen, function(index, value) {
				//Leerwerte ausschliessen, aber nicht die 0
				if (beziehungen[x][value] !== "" && beziehungen[x][value] !== null) {
					//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
					if (metadaten[0].DsTabelle === "tblMooseFnsApFm") {
						Beziehung.Biotopbindung = beziehungen[x][value];
					} else {
						Beziehung[value] = beziehungen[x][value];
					}
				}
			});
			//die Beziehung anfügen
			Datensammlung.Beziehungen.push(Beziehung);
		}
	}
	if (Datensammlung.Beziehungen.length > 0) {
		//nur, wenn Beziehungen existieren!
		//die Beziehungen nach Objektnamen sortieren
		Datens = sortiereBeziehungenNachName(Datensammlung.Beziehungen);
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (art) {
				//Datensammlung der Art zufügen
				if (!art.Beziehungssammlungen) {
					art.Beziehungssammlungen = [];
					art.Beziehungssammlungen.push(Datensammlung);
				} else {
					artDerBeziehungExistiertSchon = false;
					//kontrollieren, ob diese Art von Beziehungssammlungen schon existiert
					for (var i in art.Beziehungssammlungen) {
						if (art.Beziehungssammlungen[i].Name === Datensammlung.Name) {
							artDerBeziehungExistiertSchon = true;
							//Beziehungssammlungen in vorhandener Datensammlung ergänzen
							for (var q=0; q<Datensammlung.Beziehungen.length; q++) {
								art.Beziehungssammlungen[i].Beziehungen.push(Datensammlung.Beziehungen[q]);
							}
							//und neu sortieren
							art.Beziehungssammlungen[i].Beziehungen = sortiereBeziehungenNachName(art.Beziehungssammlungen[i].Beziehungen);
						}
					}
					if (!artDerBeziehungExistiertSchon) {
						//Datensammlung sammt Beziehung ergänzen
						art.Beziehungssammlungen.push(Datensammlung);
					}
				}
				if (art.Beziehungssammlungen.length > 0) {
					//Datensammlungen nach Name sortieren
					art.Beziehungssammlungen = sortiereObjektarrayNachName(art.Beziehungssammlungen);
				}
				$db.saveDoc(art);
			}
		});
	}
}

function importiereLrLrBeziehungen() {
	importiereLrLrBeziehungenSynonyme();
	setTimeout(function() {
		importiereLrLrBeziehungenUntereinheiten();
	}, 15000);
}

function importiereLrLrBeziehungenSynonyme() {
	$.when(initiiereImport()).then(function() {
		//Objekt gründen, in das der Array mit allen zu aktualisierenden Dokumenten eingefügt werden soll
		var docObjekt = {};
		//Array gründen, worin alle zu aktualisierenden Dokumente eingefügt werden sollen
		window.docArraySynonym = [];
		//keine Informationen zu Datensammlungen vorhanden
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window.tblLrLrBezSynonym) {
			window.tblLrLrBezSynonym = frageSql(window.myDB, 'SELECT * FROM qryLrLrBez_import WHERE [Art der Beziehung]="Synonym von"');
		}
		//wenn noch nicht vorhanden...
		if (!window.tblLrLrBezSynonym_artenliste) {
			//liste aller Arten holen, von denen Beziehungen importiert werden sollen
			window.tblLrLrBezSynonym_artenliste = frageSql(window.myDB, 'SELECT qryLrLrBez_import.[LR1 GUID] AS [GUID] FROM qryLrLrBez_import WHERE qryLrLrBez_import.[Art der Beziehung]="Synonym von" UNION SELECT qryLrLrBez_import.[LR2 GUID] AS [GUID] from qryLrLrBez_import WHERE qryLrLrBez_import.[Art der Beziehung]="Synonym von"');
		}
		//jetzt durch alle Objekte loopen und ihre LR-Moose-Beziehungen ergänzen
		for (var f in window.tblLrLrBezSynonym_artenliste) {
			//jetzt die Beziehungen dieser Art holen und in den Array einfügen
			importiereLrLrBeziehungenFuerLr(window.tblLrLrBezSynonym_artenliste[f].GUID, "Synonyme Lebensräume", "Synonym");
		}
		//und speichern
		//ganz lang warten, damit alle vorigen Operationen abgeschlossen sind
		setTimeout(function() {
			//Das Objekt mit der Liste aller Dokumente bilden
			docObjekt.docs = window.docArraySynonym;
			$db = $.couch.db("artendb");
			$db.bulkSave(docObjekt, {
				success: function() {
					console.log(window.docArraySynonym.length + " synonyme Beziehungen importiert");
					delete window.docArraySynonym;
				}
			});
		}, 10000);
	});
}

function importiereLrLrBeziehungenUntereinheiten() {
	$.when(initiiereImport()).then(function() {
		//Objekt gründen, in das der Array mit allen zu aktualisierenden Dokumenten eingefügt werden soll
		var docObjekt = {};
		//Array gründen, worin alle zu aktualisierenden Dokumente eingefügt werden sollen
		window.docArrayUntereinheitVon = [];
		//keine Informationen zu Datensammlungen vorhanden
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window.tblLrLrBezUntereinheitVon) {
			window.tblLrLrBezUntereinheitVon = frageSql(window.myDB, 'SELECT * FROM qryLrLrBez_import WHERE [Art der Beziehung]="Untereinheit von"');
		}
		//wenn noch nicht vorhanden...
		if (!window.tblLrLrBezUntereinheitVon_artenliste) {
			//liste aller Arten holen, von denen Beziehungen importiert werden sollen
			window.tblLrLrBezUntereinheitVon_artenliste = frageSql(window.myDB, 'SELECT qryLrLrBez_import.[LR1 GUID] AS [GUID] FROM qryLrLrBez_import WHERE qryLrLrBez_import.[Art der Beziehung]="Untereinheit von" UNION SELECT qryLrLrBez_import.[LR2 GUID] AS [GUID] from qryLrLrBez_import WHERE qryLrLrBez_import.[Art der Beziehung]="Untereinheit von"');
		}
		//jetzt durch alle Objekte loopen und ihre LR-Moose-Beziehungen ergänzen
		for (var f in window.tblLrLrBezUntereinheitVon_artenliste) {
			//jetzt die Beziehungen dieser Art holen und in den Array einfügen
			importiereLrLrBeziehungenFuerLr(window.tblLrLrBezUntereinheitVon_artenliste[f].GUID, "Hierarchisch über-/untergeordnete Lebensräume", "UntereinheitVon");
		}
		//und speichern
		//ganz lang warten, damit alle vorigen Operationen abgeschlossen sind
		setTimeout(function() {
			//Das Objekt mit der Liste aller Dokumente bilden
			docObjekt.docs = window.docArrayUntereinheitVon;
			$db = $.couch.db("artendb");
			$db.bulkSave(docObjekt, {
				success: function() {
					console.log(window.docArrayUntereinheitVon.length + " hierarchische Beziehungen importiert");
					delete window.docArrayUntereinheitVon;
				}
			});
		}, 10000);
	});
}

//importiert die LR-LR-Beziehungen eines Lebensraums
//benötigt deren GUID
function importiereLrLrBeziehungenFuerLr (GUID, DsName, tblPostpend) {
	var LR1;
	var LR2;
	var Beziehung;
	var Gruppe;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	//das sind alles taxonomische Beziehungen. kenntlich machen, damit sie separat dargestellt werden können
	Datensammlung.Typ = "taxonomisch";
	//Datensammlung.Beschreibung = "Diese Datensammlung ist nicht beschrieben";
	//Daten der Datensammlung schreiben
	if (window["tblLrLrBez" + tblPostpend][0]["Art der Beziehung"] === "Synonym von") {
		Datensammlung.Name = DsName + ": synonym";
		Datensammlung.Typ = "taxonomisch";
		Datensammlung["Art der Beziehungen"] = "synonym";
	} else {
		//Wert ist "Untereinheit von"
		Datensammlung.Name = DsName + ": hierarchisch";
		Datensammlung.Typ = "taxonomisch";
		Datensammlung["Art der Beziehungen"] = "hierarchisch";
	}
	Datensammlung["importiert von"] = "alexander.gabriel@bd.zh.ch";

	//den Array für die Beziehungen schaffen
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < window["tblLrLrBez" + tblPostpend].length; x++) {
		if (window["tblLrLrBez" + tblPostpend][x]["LR1 GUID"] === GUID || window["tblLrLrBez" + tblPostpend][x]["LR2 GUID"] === GUID) {
			//Das ist der richtige Typ Beziehung und sie enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			//Gruppe = "Lebensräume";
			LR1 = {};
			LR1.Gruppe = "Lebensräume";
			LR1.Taxonomie = window["tblLrLrBez" + tblPostpend][x]["LR1 Taxonomie"];
			LR1.Name = window["tblLrLrBez" + tblPostpend][x]["LR1 Name"];
			LR1.GUID = window["tblLrLrBez" + tblPostpend][x]["LR1 GUID"];
			LR2 = {};
			LR2.Gruppe = "Lebensräume";
			LR2.Taxonomie = window["tblLrLrBez" + tblPostpend][x]["LR2 Taxonomie"];
			LR2.Name = window["tblLrLrBez" + tblPostpend][x]["LR2 Name"];
			LR2.GUID = window["tblLrLrBez" + tblPostpend][x]["LR2 GUID"];
			//Daten der Datensammlung schreiben
			if (window["tblLrLrBez" + tblPostpend][x]["Art der Beziehung"] === "Untereinheit von") {
				//Wert ist "Untereinheit von"
				LR2.Rolle = "übergeordnet";
				LR1.Rolle = "untergeordnet";
			}
			if (window["tblLrLrBez" + tblPostpend][x]["LR2 GUID"] === GUID) {
				//Art ist LR2. Beziehungspartner aus LR1 speichern
				Beziehung.Beziehungspartner.push(LR1);
			} else if (window["tblLrLrBez" + tblPostpend][x]["LR1 GUID"] === GUID) {
				//Art ist LR1. Beziehungspartner aus LR2 speichern
				Beziehung.Beziehungspartner.push(LR2);
			}
			//die Beziehung anfügen
			Datensammlung.Beziehungen.push(Beziehung);
		}
	}
	if (Datensammlung.Beziehungen.length > 0) {
		//nur, wenn Beziehungen existieren!
		Datensammlung.Beziehungen = sortiereBeziehungenNachName(Datensammlung.Beziehungen);
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (lr) {
				if (!lr.Beziehungssammlungen) {
					lr.Beziehungssammlungen = [];
				}
				lr.Beziehungssammlungen.push(Datensammlung);
				//Datensammlungen nach Name sortieren
				if (lr.Beziehungssammlungen.length > 0) {
					lr.Beziehungssammlungen = sortiereObjektarrayNachName(lr.Beziehungssammlungen);
				}
				window["docArray" + tblPostpend].push(lr);
			}
		});
	}
}








function initiiereImport() {
	var initiiert = $.Deferred();
	//mit der mdb verbinden
	window.myDB = verbindeMitMdb();
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
		success: function () {
			initiiert.resolve();
		}
	});
	return initiiert.promise();
}

function verbindeMitMdb() {
	var myDB, dbPfad;
	if ($("#dbpfad").val()) {
		dbPfad = $("#dbpfad").val();
	} else {
		dbPfad = "C:\\Users\\alex\\artendb_import\\export_in_json.mdb";
	}
	myDB = new ACCESSdb(dbPfad, {showErrors:false});
	return myDB;
}

//nimmt die DB und einen sql-String entgegen
//fragt die DB ab und retourniert ein JSON-Objekt
function frageSql(db, sql) {
	var qry, a, b, c, d;
	qry = db.query(sql, {json:true});
	if (qry.length > 0) {
		a = JSON.stringify(qry);
		//Rückgabewert ist in "" eingepackt > entfernen
		b = a.slice(1, a.length -1);
		//im Rückgabewert sind alle " mit \" ersetzt. Das ist kein valid JSON!
		c = b.replace(/\\\"/gm, "\"");
		//jetzt haben wir valid JSON. In ein Objekt parsen
		//console.log(c);
		d = JSON.parse(c);
		return d;
	} else {
		return null;
	}
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
	$.when(initiiereImport()).then(function() {
		var DatensammlungenFlora, sqlDatensammlungenFlora, DatensammlungenFauna, sqlDatensammlungenFauna, DatensammlungenMoos, sqlDatensammlungenMoos, DatensmmlungenMacromycetes, sqlDatensammlungMacromycetes, DatensmmlungenLRs, sqlDatensammlungLR, html, qryAnzDs, anzDs, anzButtons;
		sqlDatensammlungenFlora = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblFloraSisf' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblFloraSisf' ORDER BY DsReihenfolge";
		DatensammlungenFlora = frageSql(window.myDB, sqlDatensammlungenFlora);
		if (DatensammlungenFlora) {
			html = "Flora Datensammlungen:<br>";
			for (var i in DatensammlungenFlora) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(" + DatensammlungenFlora[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenFlora[i].DsTabelle);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenFlora[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenFlora[i].DsTabelle + y;
					html += "' name='SchaltflächeFloraDatensammlung' Tabelle='" + DatensammlungenFlora[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenFlora[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFloraDatensammlungen").html(html);

			//jetzt Fauna
			sqlDatensammlungenFauna = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblFaunaCscf' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblFaunaCscf' ORDER BY DsReihenfolge";
			DatensammlungenFauna = frageSql(window.myDB, sqlDatensammlungenFauna);
			html = "Fauna Datensammlungen:<br>";
			for (i in DatensammlungenFauna) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(" + DatensammlungenFauna[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenFauna[i].DsTabelle);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenFauna[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenFauna[i].DsTabelle + y;
					html += "' name='SchaltflächeFaunaDatensammlung' Tabelle='" + DatensammlungenFauna[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenFauna[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFaunaDatensammlungen").html(html);

			//jetzt Moos
			sqlDatensammlungenMoos = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblMooseNism' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblMooseNism' ORDER BY DsReihenfolge";
			DatensammlungenMoos = frageSql(window.myDB, sqlDatensammlungenMoos);
			html = "Moose Datensammlungen:<br>";
			for (i in DatensammlungenMoos) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(" + DatensammlungenMoos[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenMoos[i].DsTabelle);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenMoos[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenMoos[i].DsTabelle + y;
					html += "' name='SchaltflächeMoosDatensammlung' Tabelle='" + DatensammlungenMoos[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenMoos[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenMoosDatensammlungen").html(html);

			//jetzt Macromycetes
			sqlDatensammlungenMacromycetes = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblMacromycetes' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblMacromycetes' ORDER BY DsReihenfolge";
			DatensammlungenMacromycetes = frageSql(window.myDB, sqlDatensammlungenMacromycetes);
			html = "Macromycetes Datensammlungen:<br>";
			for (i in DatensammlungenMacromycetes) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(" + DatensammlungenMacromycetes[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenMacromycetes[i].DsTabelle);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenMacromycetes[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenMacromycetes[i].DsTabelle + y;
					html += "' name='SchaltflächeMacromycetesDatensammlung' Tabelle='" + DatensammlungenMacromycetes[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenMacromycetes[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenMacromycetesDatensammlungen").html(html);

			//jetzt LR
			sqlDatensammlungenLR = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'LR' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'LR' ORDER BY DsReihenfolge";
			DatensammlungenLR = frageSql(window.myDB, sqlDatensammlungenLR);
			html = "LR Datensammlungen:<br>";
			for (i in DatensammlungenLR) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(" + DatensammlungenLR[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenLR[i].DsTabelle);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenLR[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenLR[i].DsTabelle + y;
					html += "' name='SchaltflächeLRDatensammlung' Tabelle='" + DatensammlungenLR[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenLR[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenLRDatensammlungen").html(html);

			//jetzt Flora-Bauna-Beziehungen Ebert
			sqlDatensammlungenFloraFaunaBezEbert = "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle='tblFloraFaunaBezEbert' ORDER BY DsReihenfolge";
			DatensammlungenFloraFaunaBezEbert = frageSql(window.myDB, sqlDatensammlungenFloraFaunaBezEbert);
			//liste aller Arten erzeugen, von denen Beziehungen importiert werden sollen
			if (!window.tblFloraFaunaBezEbert_artenliste) {
				window.tblFloraFaunaBezEbert_artenliste = frageSql(window.myDB, 'SELECT tblFloraFaunaBezEbert_import.[Flora GUID] AS [GUID] FROM tblFloraFaunaBezEbert_import UNION SELECT tblFloraFaunaBezEbert_import.[Fauna GUID] AS [GUID] from tblFloraFaunaBezEbert_import');
			}
			html = "";
			for (i in DatensammlungenFloraFaunaBezEbert) {
				//Anzahl Datensätze ermitteln
				anzDs = window.tblFloraFaunaBezEbert_artenliste.length;
				anzButtons = Math.ceil(anzDs/DatensammlungenFloraFaunaBezEbert[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenFloraFaunaBezEbert[i].DsTabelle + y;
					html += "' name='FloraFaunaBezEbert' Tabelle='" + DatensammlungenFloraFaunaBezEbert[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenFloraFaunaBezEbert[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFloraFaunaBezEbert").html(html);

			//jetzt Flora-Bauna-Beziehungen Westrich
			sqlDatensammlungenFloraFaunaBezWestrich = "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle='tblFloraFaunaBezWestrich' ORDER BY DsReihenfolge";
			DatensammlungenFloraFaunaBezWestrich = frageSql(window.myDB, sqlDatensammlungenFloraFaunaBezWestrich);
			//liste aller Arten erzeugen, von denen Beziehungen importiert werden sollen
			if (!window.tblFloraFaunaBezWestrich_artenliste) {
				window.tblFloraFaunaBezWestrich_artenliste = frageSql(window.myDB, 'SELECT tblFloraFaunaBezWestrich_import.[Flora GUID] AS [GUID] FROM tblFloraFaunaBezWestrich_import UNION SELECT tblFloraFaunaBezWestrich_import.[Fauna GUID] AS [GUID] from tblFloraFaunaBezWestrich_import');
			}
			html = "";
			for (i in DatensammlungenFloraFaunaBezWestrich) {
				//Anzahl Datensätze ermitteln
				anzDs = window.tblFloraFaunaBezWestrich_artenliste.length;
				anzButtons = Math.ceil(anzDs/DatensammlungenFloraFaunaBezWestrich[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenFloraFaunaBezWestrich[i].DsTabelle + y;
					html += "' name='FloraFaunaBezWestrich' Tabelle='" + DatensammlungenFloraFaunaBezWestrich[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenFloraFaunaBezWestrich[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFloraFaunaBezWestrich").html(html);

			//jetzt LR-Fauna-Beziehungen
			sqlDatensammlungenLrFaunaBez = "SELECT * FROM qryBezMetadaten WHERE DsIndex='tblFaunaCscf' ORDER BY DsReihenfolge";
			DatensammlungenLrFaunaBez = frageSql(window.myDB, sqlDatensammlungenLrFaunaBez);
			html = "";
			for (i in DatensammlungenLrFaunaBez) {
				html += "<input type='checkbox' id='";
				html += DatensammlungenLrFaunaBez[i].DsTabelle + DatensammlungenLrFaunaBez[i].BeziehungNr;
				html += "' name='LrFaunaBez' Tabelle='" + DatensammlungenLrFaunaBez[i].DsTabelle;
				html += "' BeziehungNr=" + DatensammlungenLrFaunaBez[i].BeziehungNr;
				html += ">";
				html += DatensammlungenLrFaunaBez[i].DsName + ": " + DatensammlungenLrFaunaBez[i].Beziehung;
				html += "<br>";
			}
			$("#SchaltflächenLrFaunaBez").html(html);

			//jetzt LR-Flora-Beziehungen
			sqlDatensammlungenLrFloraBez = "SELECT * FROM qryBezMetadaten WHERE DsIndex='tblFloraSisf' ORDER BY DsReihenfolge";
			DatensammlungenLrFloraBez = frageSql(window.myDB, sqlDatensammlungenLrFloraBez);
			html = "";
			for (i in DatensammlungenLrFloraBez) {
				html += "<input type='checkbox' id='";
				html += DatensammlungenLrFloraBez[i].DsTabelle + DatensammlungenLrFloraBez[i].BeziehungNr;
				html += "' name='LrFloraBez' Tabelle='" + DatensammlungenLrFloraBez[i].DsTabelle;
				html += "' BeziehungNr=" + DatensammlungenLrFloraBez[i].BeziehungNr;
				html += ">";
				html += DatensammlungenLrFloraBez[i].DsName + ": " + DatensammlungenLrFloraBez[i].Beziehung;
				html += "<br>";
			}
			$("#SchaltflächenLrFloraBez").html(html);

			//jetzt LR-Moose-Beziehungen
			sqlDatensammlungenLrMooseBez = "SELECT * FROM qryBezMetadaten WHERE DsIndex='tblMooseNism' ORDER BY DsReihenfolge";
			DatensammlungenLrMooseBez = frageSql(window.myDB, sqlDatensammlungenLrMooseBez);
			html = "";
			for (i in DatensammlungenLrMooseBez) {
				html += "<input type='checkbox' id='";
				html += DatensammlungenLrMooseBez[i].DsTabelle + DatensammlungenLrMooseBez[i].BeziehungNr;
				html += "' name='LrMooseBez' Tabelle='" + DatensammlungenLrMooseBez[i].DsTabelle;
				html += "' BeziehungNr=" + DatensammlungenLrMooseBez[i].BeziehungNr;
				html += ">";
				html += DatensammlungenLrMooseBez[i].DsName + ": " + DatensammlungenLrMooseBez[i].Beziehung;
				html += "<br>";
			}
			$("#SchaltflächenLrMooseBez").html(html);
		} else {
			alert("Bitte den Pfad zur .mdb erfassen");
		}
	});
}

function baueIndexSchaltflächenAuf() {
	$.when(initiiereImport()).then(function() {
		var DatensammlungFlora, DatensammlungFauna, DatensammlungMoos, DatensammlungMacromycetes, html, qryAnzDs, anzDs, anzButtons;
		//zuerst Flora
		DatensammlungFlora = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFloraSisf'");
		if (DatensammlungFlora) {
			html = "";
			for (var i in DatensammlungFlora) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(GUID) AS Anzahl FROM tblFloraSisf_import");
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungFlora[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='tblFloraSisf" + y;
					html += "' name='SchaltflächeFloraIndex' Tabelle='tblFloraSisf";
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>Flora Taxonomie";
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFloraIndex").html(html);

			//jetzt Fauna
			DatensammlungFauna = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFaunaCscf'");
			html = "";
			for (i in DatensammlungFauna) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(GUID) AS Anzahl FROM tblFaunaCscf_import");
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungFauna[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='tblFaunaCscf" + y;
					html += "' name='SchaltflächeFaunaIndex' Tabelle='tblFaunaCscf";
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>Fauna Taxonomie";
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFaunaIndex").html(html);

			//jetzt Moos
			DatensammlungMoos = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMooseNism'");
			html = "";
			for (i in DatensammlungMoos) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(TAXONNO) AS Anzahl FROM tblMooseNism");
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungMoos[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='tblMooseNism" + y;
					html += "' name='SchaltflächeMoosIndex' Tabelle='tblMooseNism";
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>Moose Taxonomie";
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenMoosIndex").html(html);

			//jetzt Pilze
			DatensammlungMacromycetes = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMacromycetes'");
			html = "";
			for (i in DatensammlungMacromycetes) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(GUID) AS Anzahl FROM tblMacromycetes");
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungMacromycetes[0].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='tblMacromycetes" + y;
					html += "' name='SchaltflächeMacromycetesIndex' Tabelle='tblMacromycetes";
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>Macromycetes Taxonomie";
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenMacromycetesIndex").html(html);

			//jetzt LR
			DatensammlungLR = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'LR'");
			html = "";
			for (i in DatensammlungLR) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(GUID) AS Anzahl FROM LR");
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungLR[0].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='LR" + y;
					html += "' name='SchaltflächeLRIndex' Tabelle='LR";
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>LR Taxonomie";
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenLRIndex").html(html);
		} else {
			alert("Bitte den Pfad zur .mdb erfassen");
		}
	});
}

function löscheDokument(DocId) {
	$db = $.couch.db("artendb");
	$db.openDoc(DocId, {
		success: function (document) {
			$db.removeDoc(document);
		}
	});
}

//übernimmt einen Viewname und löscht alle zugehörigen Dokumente
function löscheDokumenteVonView(viewname) {
	var dokumenteVonViewGelöscht = $.Deferred();
	$db = $.couch.db("artendb");
	$db.view('artendb/' + viewname, {
		success: function (data) {
			$.when(loescheMitIdRevListe(data))
				.then(function() {
					//dann den eingefügten Node wählen
					dokumenteVonViewGelöscht.resolve();
				});
		}
	});
	return dokumenteVonViewGelöscht.promise();
}

//löscht Datensätze in Massen
//nimmt das Ergebnis einer Abfrage entgegen, welche im key einen Array hat
//Array[0] die _id des zu löschenden Datensatzes und Array[1] dessen _rev
function loescheMitIdRevListe(Datensatzobjekt) {
	var ObjektMitDeleteListe, Docs, Datensatz, rowkey, anzDs;
	var dokumenteVonDatensatzobjektGelöscht = $.Deferred();
	ObjektMitDeleteListe = {};
	Docs = [];
	anzDs = Datensatzobjekt.rows.length;
	if (anzDs >  0) {
		for (var i in Datensatzobjekt.rows) {
			if (typeof i !== "function") {
				//unsere Daten sind im key
				rowkey = Datensatzobjekt.rows[i].key;
				Datensatz = {};
				Datensatz._id = rowkey[0];
				Datensatz._rev = rowkey[1];
				Datensatz._deleted = true;
				Docs.push(Datensatz);
			}
		}
		ObjektMitDeleteListe.docs = Docs;
		$.ajax({
			type: "POST",
			//url: "../../_bulk_docs",
			url: "http://127.0.0.1:5984/artendb/_bulk_docs",
			contentType: "application/json",
			data: JSON.stringify(ObjektMitDeleteListe)
		}).done(function() {
			dokumenteVonDatensatzobjektGelöscht.resolve();
		});
	} else {
		console.log("Datensatzliste " + JSON.stringify(Datensatzobjekt) + "enthielt keine Datensätze");
		dokumenteVonDatensatzobjektGelöscht.resolve();
	}
	return dokumenteVonDatensatzobjektGelöscht.promise();
}

//übernimmt ein Objekt und einen Array
//prüft, ob das Objekt im Array enthalten ist
function containsObject(obj, list) {
	for (var i = 0; i < list.length; i++) {
		if (list[i] === obj) {
			return true;
		}
	}
	return false;
}

function sortiereObjektarrayNachName(objektarray) {
	//Beziehungssammlungen bzw. Datensammlungen nach Name sortieren
	objektarray.sort(function(a, b) {
		var aName = a.Name;
		var bName = b.Name;
		if (aName && bName) {
			return (aName.toLowerCase() == bName.toLowerCase()) ? 0 : (aName.toLowerCase() > bName.toLowerCase()) ? 1 : -1;
		} else {
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		}
	});
	return objektarray;
}

//übernimmt einen Array mit den Beziehungen
//gibt diesen sortiert zurück
function sortiereBeziehungenNachName(beziehungen) {
//Beziehungen nach Name sortieren
	beziehungen.sort(function(a, b) {
		var aName, bName;
		for (var c in a.Beziehungspartner) {
			if (a.Beziehungspartner[c].Gruppe === "Lebensräume") {
				//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
				aName = a.Beziehungspartner[c].Gruppe + a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
			} else {
				aName = a.Beziehungspartner[c].Gruppe + a.Beziehungspartner[c].Name;
			}
		}
		for (var d in b.Beziehungspartner) {
			if (b.Beziehungspartner[d].Gruppe === "Lebensräume") {
				bName = b.Beziehungspartner[d].Gruppe + b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
			} else {
				bName = b.Beziehungspartner[d].Gruppe + b.Beziehungspartner[d].Name;
			}
		}
		if (aName && bName) {
			return (aName.toLowerCase() == bName.toLowerCase()) ? 0 : (aName.toLowerCase() > bName.toLowerCase()) ? 1 : -1;
		} else {
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		}
	});
	return beziehungen;
}