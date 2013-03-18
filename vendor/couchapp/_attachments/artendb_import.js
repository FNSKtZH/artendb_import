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
		for (x in window.tblFloraSisf) {
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
				//Datensammlungen und Beziehungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.tblDatensammlungMetadaten[0].DsName;
				Art.Taxonomie.Beschreibung = window.tblDatensammlungMetadaten[0].DsBeschreibung;
				if (window.tblDatensammlungMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.tblDatensammlungMetadaten[0].DsDatenstand;
				}
				if (window.tblDatensammlungMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.tblDatensammlungMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art.Taxonomie.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblFloraSisf[x]) {
					if (window.tblFloraSisf[x][y] !== "" && window.tblFloraSisf[x][y] !== null && y !== "Gruppe") {
						if (window.tblFloraSisf[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Felder[y] = true;
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
							if (!Art.Beziehungen) {
								Art.Beziehungen = [];
							}
							Art.Beziehungen.push(DsSynonyme);
							//Datensammlungen nach Name sortieren
							Art.Beziehungen.sort(function(a, b) {
								var aName = a.Name;
								var bName = b.Name;
								return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
							});
						} else if (y !== "GUID") {
							//GUID ist _id, kein eigenes Feld
							Art.Taxonomie.Felder[y] = window.tblFloraSisf[x][y];
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
				for (i in data.rows) {
					var Art, ArtNr, deutscheNamen;
					Art = data.rows[i].doc;
					ArtNr = Art.Taxonomie.Felder["Taxonomie ID"];
					deutscheNamen = "";
					for (k in qryDeutscheNamen) {
						if (qryDeutscheNamen[k].SisfNr === ArtNr) {
							if (deutscheNamen) {
								deutscheNamen += ', ';
							}
							deutscheNamen += qryDeutscheNamen[k].NOM_COMMUN;
						}
					}
					if (deutscheNamen && deutscheNamen !== Art.Taxonomie.Felder["Deutsche Namen"]) {
						Art.Taxonomie.Felder["Deutsche Namen"] = deutscheNamen;
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
			for (i in data.rows) {
				Art = data.rows[i].doc;
				//Liste aller Deutschen Namen bilden
				if (Art.Taxonomie.Felder["Gültige Namen"]) {
					//es gibt gültige Namen
					var Art, GueltigeNamen, DsGueltigeNamen, BeziehungsObjekt, Beziehungspartner;
					Nrn = Art.Taxonomie.Felder["Gültige Namen"].split(",");
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
					for (a in Nrn) {
						//durch alle gültigen Nummern loopen
						for (k in data.rows) {
							//jeweils die passende Art suchen
							if (data.rows[k].doc.Taxonomie.Felder["Taxonomie ID"] == parseInt(Nrn[a])) {
								Beziehungspartner = [];
								GueltigeNamen = {};
								GueltigeNamen.Gruppe = "Flora";
								GueltigeNamen.GUID = data.rows[k].doc._id;
								GueltigeNamen.Name = data.rows[k].doc.Taxonomie.Felder["Artname vollständig"];
								Beziehungspartner.push(GueltigeNamen);
								BeziehungsObjekt = {};
								BeziehungsObjekt.Beziehungspartner = Beziehungspartner;
								DsGueltigeNamen.Beziehungen.push(BeziehungsObjekt);
								break;
							}
						}
					}
					if (DsGueltigeNamen.Beziehungen !== []) {
						delete Art.Taxonomie.Felder["Gültige Namen"];
						if (!Art.Beziehungen) {
							Art.Beziehungen = [];
						}
						Art.Beziehungen.push(DsGueltigeNamen);
						//Datensammlungen nach Name sortieren
						Art.Beziehungen.sort(function(a, b) {
							var aName = a.Name;
							var bName = b.Name;
							return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
						});
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
				for (i in data.rows) {
					//durch alle Arten loopen
					var Art, Einschluss, DsEinschluss, BeziehungsObjekt, Beziehungspartner;
					Art = data.rows[i].doc;
					for (x in Art) {
						if (Art.Taxonomie.Felder && Art.Taxonomie.Felder["Eingeschlossene Arten"]) {
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
							for (k in qryEingeschlosseneArten) {
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
							if (!Art.Beziehungen) {
								Art.Beziehungen = [];
							}
							Art.Beziehungen.push(DsEinschluss);
							//Datensammlungen nach Name sortieren
							Art.Beziehungen.sort(function(a, b) {
								var aName = a.Name;
								var bName = b.Name;
								return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
							});
							delete Art.Taxonomie.Felder["Eingeschlossene Arten"];
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
		for (k in qryFloraEingeschlossenIn) {
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
		if (!Art.Beziehungen) {
			Art.Beziehungen = [];
		}
		Art.Beziehungen.push(DsEingeschlossenIn);
		//Datensammlungen nach Name sortieren
		Art.Beziehungen.sort(function(a, b) {
			var aName = a.Name;
			var bName = b.Name;
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		});
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
		for (k in qryFloraSynonyme) {
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
		if (!Art.Beziehungen) {
			Art.Beziehungen = [];
		}
		Art.Beziehungen.push(DsSynonyme);
		//Datensammlungen nach Name sortieren
		Art.Beziehungen.sort(function(a, b) {
			var aName = a.Name;
			var bName = b.Name;
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		});
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
		for (x in window["Datensammlung" + tblName]) {
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
				//Felder der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "NR" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["tblDatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Felder[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Felder[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Felder vorkommen. Gibt sonst einen Fehler
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
		for (x in window.tblMooseNism) {
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
				//Datensammlungen und Beziehungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.DatensammlungMetadatenMoose[0].DsName;
				Art.Taxonomie.Beschreibung = window.DatensammlungMetadatenMoose[0].DsBeschreibung;
				if (window.DatensammlungMetadatenMoose[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.DatensammlungMetadatenMoose[0].DsDatenstand;
				}
				if (window.DatensammlungMetadatenMoose[0].DsLink) {
					Art.Taxonomie["Link"] = window.DatensammlungMetadatenMoose[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art.Taxonomie.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblMooseNism[x]) {
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
							if (!Art.Beziehungen) {
								Art.Beziehungen = [];
							}
							Art.Beziehungen.push(DsSynonyme);
							//Datensammlungen nach Name sortieren
							Art.Beziehungen.sort(function(a, b) {
								var aName = a.Name;
								var bName = b.Name;
								return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
							});
							delete Art.Taxonomie.Felder[y];
						} else if (window.tblMooseNism[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Felder[y] = true;
						} else if (y !== "GUID") {
							Art.Taxonomie.Felder[y] = window.tblMooseNism[x][y];
						}
					}
				}
				$db = $.couch.db("artendb");
				$db.saveDoc(Art);
			}
		}
	});
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
		for (x in window["Datensammlung" + tblName]) {
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
				//Felder der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "NR" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["DatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Felder[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Felder[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Felder vorkommen. Gibt sonst einen Fehler
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
		for (x in window.tblMacromycetes) {
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
				//Datensammlungen und Beziehungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.MacromycetesMetadaten[0].DsName;
				Art.Taxonomie.Beschreibung = window.MacromycetesMetadaten[0].DsBeschreibung;
				if (window.MacromycetesMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.MacromycetesMetadaten[0].DsDatenstand;
				}
				if (window.MacromycetesMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.MacromycetesMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art.Taxonomie.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblMacromycetes[x]) {
					if (window.tblMacromycetes[x][y] !== "" && window.tblMacromycetes[x][y] !== null && y !== "Gruppe") {
						if (window.tblMacromycetes[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Felder[y] = true;
						} else if (y !== "GUID") {
							Art.Taxonomie.Felder[y] = window.tblMacromycetes[x][y];
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
		for (x in window["Datensammlung" + tblName]) {
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
				//Felder der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "TaxonId" && y !== "tblMacromycetes.TaxonId" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["DatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Felder[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Felder[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Felder vorkommen. Gibt sonst einen Fehler
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
		for (x in window.tblFaunaCscf) {
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
				//Datensammlungen und Beziehungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungen = [];
				//Taxonomie aufbauen
				Art.Taxonomie.Name = window.FaunaMetadaten[0].DsName;
				Art.Taxonomie.Beschreibung = window.FaunaMetadaten[0].DsBeschreibung;
				if (window.FaunaMetadaten[0].DsDatenstand) {
					Art.Taxonomie.Datenstand = window.FaunaMetadaten[0].DsDatenstand;
				}
				if (window.FaunaMetadaten[0].DsLink) {
					Art.Taxonomie["Link"] = window.FaunaMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art.Taxonomie.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblFaunaCscf[x]) {
					if (window.tblFaunaCscf[x][y] !== "" && window.tblFaunaCscf[x][y] !== null && y !== "Gruppe") {
						if (window.tblFaunaCscf[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Felder[y] = true;
						} else if (y !== "GUID") {
							Art.Taxonomie.Felder[y] = window.tblFaunaCscf[x][y];
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
		for (x in window["Datensammlung" + tblName]) {
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
				//Felder der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null) {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Felder[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Felder[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Felder vorkommen. Gibt sonst einen Fehler
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
		for (x in window.tblLr) {
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
				//Datensammlungen und Beziehungen gründen, damit sie am richtigen Ort liegen
				Art.Datensammlungen = [];
				Art.Beziehungen = [];
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
				//Felder der Datensammlung als Objekt gründen
				Art.Taxonomie.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten. Gruppe ist schon eingefügt
				for (y in window.tblLr[x]) {
					if (window.tblLr[x][y] !== "" && window.tblLr[x][y] !== null && y !== "Gruppe") {
						if (window.tblLr[x][y] === -1) {
							//Access wandelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art.Taxonomie.Felder[y] = true;
						} else if (y === "Einheit-Nrn FNS von" || y === "Einheit-Nrn FNS bis") {
							//access hat irgendwie aus Zahlen Zeichen gemacht
							Art.Taxonomie.Felder[y] = parseInt(window.tblLr[x][y]);
						} else if (y === "Beschreibung" && window.tblLr[x][y]) {
							//komische Inhalte ersetzen
							Art.Taxonomie.Felder[y] = window.tblLr[x][y]
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
							Art.Taxonomie.Felder[y] = window.tblLr[x][y];
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
				for (i in data.rows) {
					var LR, Hierarchie, Hierarchie2;
					LR = data.rows[i].doc;
					if (LR.Taxonomie.Felder.Parent && typeof LR.Taxonomie.Felder.Parent === "string") {
						Hierarchie1 = [];
						LR.Taxonomie.Felder.Hierarchie = ergänzeParentZuHierarchie(data, LR._id, Hierarchie1);
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
	for (i in Lebensräume.rows) {
		var LR, parentObjekt, hierarchieErgänzt;
		LR = Lebensräume.rows[i].doc;
		if (LR._id === parentGUID) {
			parentObjekt = {};
			if (LR.Taxonomie.Felder.Label) {
				parentObjekt.Name = LR.Taxonomie.Felder.Label + ": " + LR.Taxonomie.Felder.Einheit;
			} else {
				parentObjekt.Name = LR.Taxonomie.Felder.Einheit;
			}
			parentObjekt.GUID = LR._id;
			Hierarchie.push(parentObjekt);
			if (LR.Taxonomie.Felder.Parent !== LR._id) {
				//die Hierarchie ist noch nicht zu Ende - weitermachen
				hierarchieErgänzt = ergänzeParentZuHierarchie(Lebensräume, LR.Taxonomie.Felder.Parent, Hierarchie);
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
				for (i in data.rows) {
					var LR, Parent;
					LR = data.rows[i].doc;
					if (LR.Taxonomie.Felder.Parent) {
						for (k in qryEinheiten) {
							if (qryEinheiten[k].GUID === LR.Taxonomie.Felder.Parent) {
								Parent = {};
								Parent.GUID = qryEinheiten[k].GUID;
								Parent.Name = qryEinheiten[k].Einheit;
								break;
							}
						}
						LR.Taxonomie.Felder.Parent = Parent;
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
		for (x in window["Datensammlung" + tblName]) {
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
				//Felder der Datensammlung als Objekt gründen
				DatensammlungDieserArt.Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				anzFelder = 0;
				for (y in window["Datensammlung" + tblName][x]) {
					if (y !== "GUID" && y !== "Id" && y !== "LR.Id" && window["Datensammlung" + tblName][x][y] !== "" && window["Datensammlung" + tblName][x][y] !== null && y !== window["DatensammlungMetadaten" + tblName][0].DsBeziehungsfeldDs && y !== "Gruppe") {
						if (window["Datensammlung" + tblName][x][y] === -1) {
							//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
							DatensammlungDieserArt.Felder[y] = true;
						} else {
							//Normalfall
							DatensammlungDieserArt.Felder[y] = window["Datensammlung" + tblName][x][y];
						}
						anzFelder += 1;
					}
				}
				//entsprechenden Index öffnen
				//sicherstellen, dass Felder vorkommen. Gibt sonst einen Fehler
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
			doc.Datensammlungen.sort(function(a, b) {
				var aName = a.Name;
				var bName = b.Name;
				return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
			});
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
	//Alle Arten der Beziehungen aus Access abfragen
	//durch alle Arten der Beziehungen aus Access zirkeln
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
			//Beziehungen holen
			window[tblName] = frageSql(window.myDB, "SELECT * FROM " + tblName + "_import");
		}
		//wenn noch nicht vorhanden...
		if (!window[tblName + "_artenliste"]) {
			//liste aller Arten holen, von denen Beziehungen importiert werden sollen
			window[tblName + "_artenliste"] = frageSql(window.myDB, 'SELECT ' + tblName + '_import.[Flora GUID] AS [GUID] FROM ' + tblName + '_import UNION SELECT ' + tblName + '_import.[Fauna GUID] AS [GUID] from ' + tblName + '_import');
		}
		anzDs = 0;
		for (f in window[tblName + "_artenliste"]) {
			//Artenliste in Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Häppchen (in Access-DB definiert)
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//jetzt die Beziehungen dieser Art holen
				importiereFloraFaunaBeziehungenFuerArt(window[tblName + "_artenliste"][f].GUID, tblName);
			}
			if (anzDs === Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs || anzDs === window[tblName + "_artenliste"].length) {
				console.log("Import von " + tblName + " fertig: anzDs = " + anzDs);
			}
		}
	});
}

//importiert die Flora-Fauna-Beziehungen eine Art
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
		Datensammlung.Beziehungen.sort(function(a, b) {
			var aName, bName;
			for (c in a.Beziehungspartner) {
				aName = a.Beziehungspartner[c].Name;
			}
			for (d in b.Beziehungspartner) {
				bName = b.Beziehungspartner[d].Name;
			}
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		});
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (art) {
				//Datensammlung der Art zufügen
				if (!art.Beziehungen) {
					art.Beziehungen = [];
				}
				art.Beziehungen.push(Datensammlung);
				//Datensammlungen nach Name sortieren
				art.Beziehungen.sort(function(a, b) {
					var aName = a.Name;
					var bName = b.Name;
					return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
				});
				$db.saveDoc(art);
			}
		});
	}
}

function importiereLrFaunaBeziehungen(tblName, beziehung_nr) {
	//Alle Arten der Beziehungen aus Access abfragen
	//durch alle Arten der Beziehungen aus Access zirkeln
	//darin: durch alle Beziehungen zirkeln
	//wenn die Beziehung die Art enthält, Beziehung ergänzen
	//ein mal in die couch schreiben. SONST GIBT ES KONFLIKTE
	$.when(initiiereImport()).then(function() {
		//wenn noch nicht vorhanden...
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			//Informationen zur Datensammlung holen
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		}
		//wenn noch nicht vorhanden...
		if (!window["tblLrFaunaBez" + tblName + beziehung_nr]) {
			//Beziehungen holen
			window["tblLrFaunaBez" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM tblLrFaunaBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		//wenn noch nicht vorhanden...
		if (!window["tblLrFaunaBez" + tblName + beziehung_nr + "_artenliste"]) {
			//liste aller Arten holen, von denen Beziehungen importiert werden sollen
			window["tblLrFaunaBez" + tblName + beziehung_nr + "_artenliste"] = frageSql(window.myDB, "SELECT tblLrFaunaBez_import.[Fauna GUID] AS [GUID] FROM tblLrFaunaBez_import UNION SELECT tblLrFaunaBez_import.[LR GUID] AS [GUID] from tblLrFaunaBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		anzDs = 0;
		for (f in window["tblLrFaunaBez" + tblName + beziehung_nr + "_artenliste"]) {
			anzDs += 1;
			//jetzt die Beziehungen dieser Art holen
			importiereLrFaunaBeziehungenFuerArt(window["tblLrFaunaBez" + tblName + beziehung_nr + "_artenliste"][f].GUID, tblName, beziehung_nr);
			if (anzDs === window["tblLrFaunaBez" + tblName + beziehung_nr + "_artenliste"].length) {
				console.log("Import von " + tblName + "_" + beziehung_nr + " fertig: anzDs = " + anzDs);
			}
		}
	});
}

//importiert die LR-Fauna-Beziehungen eine Art
//benötigt deren GUID und den Tabellennahmen und die Beziehungs-Nr
function importiereLrFaunaBeziehungenFuerArt (GUID, tblName, beziehung_nr) {
	var Feldnamen = ["Wert für die Beziehung", "Bemerkungen"];
	var LR;
	var Fauna;
	var Beziehung;
	var Gruppe;
	var artDerBeziehungExistiertSchon;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsName + ": " + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].Beziehung;
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung) {
		Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung;
	}
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand) {
		Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand;
	}
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink) {
		Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink;
	}
	//Art der Beziehung soll eine Eigenschaft der Datensammlung sein, nicht der Beziehung
	Datensammlung["Art der Beziehungen"] = window["tblLrFaunaBez" + tblName + beziehung_nr][0]["Art der Beziehung"];
	//den Array für die Beziehungen schaffen
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < window["tblLrFaunaBez" + tblName + beziehung_nr].length; x++) {
		if (window["tblLrFaunaBez" + tblName + beziehung_nr][x]["Fauna GUID"] === GUID || window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR GUID"] === GUID) {
			//Das ist der richtige Typ Beziehung und sie enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			if (window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR GUID"] === GUID) {
				//Art ist LR. Beziehungspartner aus Fauna speichern
				Gruppe = "Lebensräume";
				Fauna = {};
				Fauna.Gruppe = "Fauna";
				Fauna.Name = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["Fauna Name"];
				Fauna.GUID = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["Fauna GUID"];
				Beziehung.Beziehungspartner.push(Fauna);
			} else if (window["tblLrFaunaBez" + tblName + beziehung_nr][x]["Fauna GUID"] === GUID) {
				//Art ist Fauna. Beziehungspartner aus LR speichern
				Gruppe = "Fauna";
				LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR Taxonomie"];
				LR.Name = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR Name"];
				LR.GUID = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR GUID"];
				Beziehung.Beziehungspartner.push(LR);
			}
			//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
			$.each(Feldnamen, function(index, value) {
				//Leerwerte ausschliessen, aber nicht die 0
				if (window["tblLrFaunaBez" + tblName + beziehung_nr][x][value] !== "" && window["tblLrFaunaBez" + tblName + beziehung_nr][x][value] !== null) {
					//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
					if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle === "tblFaunaFnsApFm") {
						Beziehung.Biotopbindung = window["tblLrFaunaBez" + tblName + beziehung_nr][x][value];
					} else {
						Beziehung[value] = window["tblLrFaunaBez" + tblName + beziehung_nr][x][value];
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
		Datensammlung.Beziehungen.sort(function(a, b) {
			var aName, bName;
			for (c in a.Beziehungspartner) {
				if (Gruppe === "Lebensräume") {
					//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
					aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
				} else {
					aName = a.Beziehungspartner[c].Name;
				}
			}
			for (d in b.Beziehungspartner) {
				if (Gruppe === "Lebensräume") {
					bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
				} else {
					bName = b.Beziehungspartner[d].Name;
				}
			}
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		});
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (art) {
				//Datensammlung der Art zufügen
				if (!art.Beziehungen) {
					art.Beziehungen = [];
					art.Beziehungen.push(Datensammlung);
				} else {
					artDerBeziehungExistiertSchon = false;
					//kontrollieren, ob diese Art von Beziehungen schon existiert
					for (i in art.Beziehungen) {
						if (art.Beziehungen[i].Name === Datensammlung.Name) {
							artDerBeziehungExistiertSchon = true;
							//Beziehungen in vorhandener Datensammlung ergänzen
							art.Beziehungen[i].Beziehungen.push(Datensammlung.Beziehungen);
							//und neu sortieren
							art.Beziehungen[i].Beziehungen.sort(function(a, b) {
								var aName, bName;
								for (c in a.Beziehungspartner) {
									if (Gruppe === "Lebensräume") {
										//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
										aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
									} else {
										aName = a.Beziehungspartner[c].Name;
									}
								}
								for (d in b.Beziehungspartner) {
									if (Gruppe === "Lebensräume") {
										bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
									} else {
										bName = b.Beziehungspartner[d].Name;
									}
								}
								return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
							});
						}
					}
					if (!artDerBeziehungExistiertSchon) {
						//Datensammlung sammt Beziehung ergänzen
						art.Beziehungen.push(Datensammlung);
					}
				}
				//Datensammlungen nach Name sortieren
				art.Beziehungen.sort(function(a, b) {
					var aName = a.Name;
					var bName = b.Name;
					return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
				});
				$db.saveDoc(art);
			}
		});
	}
}

function importiereLrFloraBeziehungen(tblName, beziehung_nr) {
	//Alle Arten der Beziehungen aus Access abfragen
	//durch alle Arten der Beziehungen aus Access zirkeln
	//darin: durch alle Beziehungen zirkeln
	//wenn die Beziehung die Art enthält, Beziehung ergänzen
	//ein mal in die couch schreiben. SONST GIBT ES KONFLIKTE
	$.when(initiiereImport()).then(function() {
		//Objekt gründen, in das der Array mit allen zu aktualisierenden Dokumenten eingefügt werden soll
		var docObjekt = {};
		//Array gründen, worin alle zu aktualisierenden Dokumente eingefügt werden sollen
		window.docArray = [];
		window.docArray2 = [];
		var Artenliste;
		//wenn noch nicht vorhanden...
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			//Informationen zur Datensammlung holen
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		}
		//liste aller Arten holen, von denen Beziehungen importiert werden sollen
		Artenliste = frageSql(window.myDB, "SELECT tblLrFloraBez_import.[Flora GUID] AS [GUID] FROM tblLrFloraBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr + " UNION SELECT tblLrFloraBez_import.[LR GUID] AS [GUID] from tblLrFloraBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		console.log('Artenliste.length = ' + Artenliste.length);
		if (Artenliste.length < 1000) {
			//jetzt durch alle Objekte loopen und ihre LR-Flora-Beziehungen ergänzen
			for (var f = 0; f < Artenliste.length; f++) {
				//jetzt die Beziehungen dieser Art holen und in den Array einfügen
				importiereLrFloraBeziehungenFuerArt(Artenliste[f].GUID, tblName, beziehung_nr);
			}
		} else {
			//jetzt durch alle Objekte loopen und ihre LR-Flora-Beziehungen ergänzen
			console.log('0-1t importieren');
			var  anz = 1000;
			var anz2 = 2000;
			var anz3 = 3000;
			var anz4 = 4000;
			var anz5 = 5000;
			var anz6 = 6000;
			var anz7 = 7000;
			if (Artenliste.length < anz) {
				anz = Artenliste.length;
			}
			for (var f = 0; f < anz; f++) {
				importiereLrFloraBeziehungenFuerArt(Artenliste[f].GUID, tblName, beziehung_nr);
			}
			if (Artenliste.length > anz) {
				setTimeout(function() {
					if (Artenliste.length < anz2) {
						anz2 = Artenliste.length;
					}
					console.log('1-2t importieren');
					for (var g = anz; g < anz2; g++) {
						importiereLrFloraBeziehungenFuerArt(Artenliste[g].GUID, tblName, beziehung_nr);
					}
				}, 20000);
			}
			if (Artenliste.length > anz2) {
				setTimeout(function() {
					if (Artenliste.length < anz3) {
						anz3 = Artenliste.length;
					}
					console.log('2-3t importieren');
					for (var h = anz2; h < anz3; h++) {
						importiereLrFloraBeziehungenFuerArt(Artenliste[h].GUID, tblName, beziehung_nr);
					}
				}, 240000);
			}
			if (Artenliste.length > anz3) {
				setTimeout(function() {
					if (Artenliste.length < anz4) {
						anz4 = Artenliste.length;
					}
					console.log('3-4t importieren');
					for (var i = anz3; i < anz4; i++) {
						importiereLrFloraBeziehungenFuerArt(Artenliste[i].GUID, tblName, beziehung_nr);
					}
				}, 460000);
			}
			if (Artenliste.length > anz4) {
				setTimeout(function() {
					if (Artenliste.length < anz5) {
						anz5 = Artenliste.length;
					}
					console.log('4-5t importieren');
					for (var j = anz4; j < anz5; j++) {
						importiereLrFloraBeziehungenFuerArt(Artenliste[j].GUID, tblName, beziehung_nr);
					}
				}, 680000);
			}
			if (Artenliste.length > anz5) {
				setTimeout(function() {
					if (Artenliste.length < anz6) {
						anz6 = Artenliste.length;
					}
					console.log('5-6t importieren');
					for (var k = anz5; k < anz6 || k < Artenliste.length; k++) {
						importiereLrFloraBeziehungenFuerArt(Artenliste[k].GUID, tblName, beziehung_nr);
					}
				}, 900000);
			}
			if (Artenliste.length > anz6) {
				setTimeout(function() {
					if (Artenliste.length < anz7) {
						anz7 = Artenliste.length;
					}
					console.log('6-7t importieren');
					for (var l = anz6; l < anz7 || l < Artenliste.length; l++) {
						importiereLrFloraBeziehungenFuerArt(Artenliste[l].GUID, tblName, beziehung_nr);
					}
				}, 1060000);
			}
		}
			
	});
}

//importiert die LR-Flora-Beziehungen einer Art
//benötigt deren GUID und den Tabellennahmen und die Beziehungs-Nr
function importiereLrFloraBeziehungenFuerArt (GUID, tblName, beziehung_nr) {
	var Feldnamen = ["Wert für die Beziehung", "Bemerkungen"];
	var LR;
	var Flora;
	var Beziehungen;
	var Beziehung;
	var Gruppe;
	var anzBeziehungen;
	var artDerBeziehungExistiertSchon;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsName + ": " + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].Beziehung;
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung) {
		Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung;
	}
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand) {
		Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand;
	}
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink) {
		Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink;
	}
	//Art der Beziehung jetzt schon anlegen, damit es vor den Beziehungen liegt
	//Datensammlung["Art der Beziehungen"] = "";
	//den Array für die Beziehungen schaffen
	//Datensammlung.Beziehungen = [];
	//Alle Beziehungen dieser Art holen
	anzBeziehungen = frageSql(window.myDB, "SELECT Count(tblLrFloraBez_import.GUID) AS Anzahl FROM tblLrFloraBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr + " AND ([Flora GUID]='" + GUID + "' OR [LR GUID]='" + GUID + "')");
	//nur weiterfahren, wenn Beziehungen existieren
	if (anzBeziehungen[0].Anzahl > 0) {
		Beziehungen = frageSql(window.myDB, "SELECT * FROM tblLrFloraBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr + " AND ([Flora GUID]='" + GUID + "' OR [LR GUID]='" + GUID + "')");
		//Art der Beziehung soll eine Eigenschaft der Datensammlung sein, nicht der Beziehungen
		Datensammlung["Art der Beziehungen"] = Beziehungen[0]["Art der Beziehung"];
		//den Array für die Beziehungen schaffen - erst jetzt, damit es unter "Art der Beziehungen" liegt
		Datensammlung.Beziehungen = [];
		//durch alle Beziehungen loopen
		for (var x = 0; x < Beziehungen.length; x++) {
			if (Beziehungen[x]["Flora GUID"] === GUID || Beziehungen[x]["LR GUID"] === GUID) {
				//Das ist der richtige Typ Beziehung und sie enthält diese Art
				Beziehung = {};
				Beziehung.Beziehungspartner = [];
				if (Beziehungen[x]["LR GUID"] === GUID) {
					//Art ist LR. Beziehungspartner aus Flora speichern
					Gruppe = "Lebensräume";
					Flora = {};
					Flora.Gruppe = "Flora";
					Flora.Name = Beziehungen[x]["Flora Name"];
					Flora.GUID = Beziehungen[x]["Flora GUID"];
					Beziehung.Beziehungspartner.push(Flora);
				} else if (Beziehungen[x]["Flora GUID"] === GUID) {
					//Art ist Flora. Beziehungspartner aus LR speichern
					Gruppe = "Flora";
					LR = {};
					LR.Gruppe = "Lebensräume";
					LR.Taxonomie = Beziehungen[x]["LR Taxonomie"];
					LR.Name = Beziehungen[x]["LR Name"];
					LR.GUID = Beziehungen[x]["LR GUID"];
					Beziehung.Beziehungspartner.push(LR);
				}
				//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
				$.each(Feldnamen, function(index, value) {
					//Leerwerte ausschliessen, aber nicht die 0
					if (Beziehungen[x][value] !== "" && Beziehungen[x][value] !== null) {
						//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
						if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle === "tblFloraFnsApFm") {
							Beziehung.Biotopbindung = Beziehungen[x][value];
						} else {
							Beziehung[value] = Beziehungen[x][value];
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
			Datensammlung.Beziehungen.sort(function(a, b) {
				var aName, bName;
				for (c in a.Beziehungspartner) {
					if (Gruppe === "Lebensräume") {
						//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
						aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
					} else {
						aName = a.Beziehungspartner[c].Name;
					}
				}
				for (d in b.Beziehungspartner) {
					if (Gruppe === "Lebensräume") {
						bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
					} else {
						bName = b.Beziehungspartner[d].Name;
					}
				}
				return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
			});
			//jetzt die Art um diese Beziehung ergänzen
			$db = $.couch.db("artendb");
			$db.openDoc(GUID, {
				success: function (art) {
					//Datensammlung der Art zufügen
					if (!art.Beziehungen) {
						art.Beziehungen = [];
						art.Beziehungen.push(Datensammlung);
					} else {
						artDerBeziehungExistiertSchon = false;
						//kontrollieren, ob diese Art von Beziehungen schon existiert
						for (i in art.Beziehungen) {
							if (art.Beziehungen[i].Name === Datensammlung.Name) {
								artDerBeziehungExistiertSchon = true;
								//Beziehungen in vorhandener Datensammlung ergänzen
								art.Beziehungen[i].Beziehungen.push(Datensammlung.Beziehungen);
								//und neu sortieren
								art.Beziehungen[i].Beziehungen.sort(function(a, b) {
									var aName, bName;
									for (c in a.Beziehungspartner) {
										if (Gruppe === "Lebensräume") {
											//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
											aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
										} else {
											aName = a.Beziehungspartner[c].Name;
										}
									}
									for (d in b.Beziehungspartner) {
										if (Gruppe === "Lebensräume") {
											bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
										} else {
											bName = b.Beziehungspartner[d].Name;
										}
									}
									return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
								});
							}
						}
						if (!artDerBeziehungExistiertSchon) {
							//Datensammlung sammt Beziehung ergänzen
							art.Beziehungen.push(Datensammlung);
						}
					}
					//Datensammlungen nach Name sortieren
					art.Beziehungen.sort(function(a, b) {
						var aName = a.Name;
						var bName = b.Name;
						return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
					});
					$db.saveDoc(art);
				}
			});
		}
	}
}

function importiereLrMooseBeziehungen(tblName, beziehung_nr) {
	//Alle Arten der Beziehungen aus Access abfragen
	//durch alle Arten der Beziehungen aus Access zirkeln
	//darin: durch alle Beziehungen zirkeln
	//wenn die Beziehung die Art enthält, Beziehung ergänzen
	//ein mal in die couch schreiben. SONST GIBT ES KONFLIKTE
	$.when(initiiereImport()).then(function() {
		//wenn noch nicht vorhanden...
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			//Informationen zur Datensammlung holen
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		}
		//wenn noch nicht vorhanden...
		if (!window["tblLrMooseBez" + tblName + beziehung_nr]) {
			//Beziehungen holen
			window["tblLrMooseBez" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM tblLrMooseBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		console.log('window[tblLrMooseBez' + tblName + beziehung_nr + '].length = ' + window["tblLrMooseBez" + tblName + beziehung_nr].length);
		//wenn noch nicht vorhanden...
		if (!window["tblLrMooseBez" + tblName + beziehung_nr + "_artenliste"]) {
			//liste aller Arten holen, von denen Beziehungen importiert werden sollen
			window["tblLrMooseBez" + tblName + beziehung_nr + "_artenliste"] = frageSql(window.myDB, "SELECT tblLrMooseBez_import.[Moos GUID] AS [GUID] FROM tblLrMooseBez_import UNION SELECT tblLrMooseBez_import.[LR GUID] AS [GUID] from tblLrMooseBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		console.log('window[tblLrMooseBez' + tblName + beziehung_nr + '_artenliste].length = ' + window["tblLrMooseBez" + tblName + beziehung_nr + "_artenliste"].length);
		//jetzt durch alle Objekte loopen und ihre LR-Moose-Beziehungen ergänzen
		for (f in window["tblLrMooseBez" + tblName + beziehung_nr + "_artenliste"]) {
			//jetzt die Beziehungen dieser Art holen und in den Array einfügen
			importiereLrMooseBeziehungenFuerArt(window["tblLrMooseBez" + tblName + beziehung_nr + "_artenliste"][f].GUID, tblName, beziehung_nr);
		}
	});
}

//importiert die LR-Moose-Beziehungen einer Art
//benötigt deren GUID und den Tabellennahmen und die Beziehungs-Nr
function importiereLrMooseBeziehungenFuerArt (GUID, tblName, beziehung_nr) {
	var Feldnamen = ["Wert für die Beziehung", "Bemerkungen"];
	var LR;
	var Moose;
	var Beziehung;
	var Gruppe;
	var artDerBeziehungExistiertSchon;
	//Datensammlung als Objekt gründen
	var Datensammlung = {};
	Datensammlung.Name = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsName + ": " + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].Beziehung;
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung) {
		Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung;
	}
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand) {
		Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand;
	}
	if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink) {
		Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink;
	}
	//Art der Beziehung soll eine Eigenschaft der Datensammlung sein, nicht der Beziehungen
	Datensammlung["Art der Beziehungen"] = window["tblLrMooseBez" + tblName + beziehung_nr][0]["Art der Beziehung"];
	//den Array für die Beziehungen schaffen
	Datensammlung.Beziehungen = [];
	//durch alle Beziehungen loopen
	for (var x = 0; x < window["tblLrMooseBez" + tblName + beziehung_nr].length; x++) {
		if (window["tblLrMooseBez" + tblName + beziehung_nr][x]["Moos GUID"] === GUID || window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR GUID"] === GUID) {
			//Das ist der richtige Typ Beziehung und sie enthält diese Art
			Beziehung = {};
			Beziehung.Beziehungspartner = [];
			if (window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR GUID"] === GUID) {
				//Art ist LR. Beziehungspartner aus Moose speichern
				Gruppe = "Lebensräume";
				Moos = {};
				Moos.Gruppe = "Moose";
				Moos.Name = window["tblLrMooseBez" + tblName + beziehung_nr][x]["Moos Name"];
				Moos.GUID = window["tblLrMooseBez" + tblName + beziehung_nr][x]["Moos GUID"];
				Beziehung.Beziehungspartner.push(Moos);
			} else if (window["tblLrMooseBez" + tblName + beziehung_nr][x]["Moos GUID"] === GUID) {
				//Art ist Moose. Beziehungspartner aus LR speichern
				Gruppe = "Moose";
				LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR Taxonomie"];
				LR.Name = window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR Name"];
				LR.GUID = window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR GUID"];
				Beziehung.Beziehungspartner.push(LR);
			}
			//Eigenschaften der Beziehung schreiben, wenn sie Werte enthalten
			$.each(Feldnamen, function(index, value) {
				//Leerwerte ausschliessen, aber nicht die 0
				if (window["tblLrMooseBez" + tblName + beziehung_nr][x][value] !== "" && window["tblLrMooseBez" + tblName + beziehung_nr][x][value] !== null) {
					//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
					if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle === "tblMooseFnsApFm") {
						Beziehung.Biotopbindung = window["tblLrMooseBez" + tblName + beziehung_nr][x][value];
					} else {
						Beziehung[value] = window["tblLrMooseBez" + tblName + beziehung_nr][x][value];
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
		Datensammlung.Beziehungen.sort(function(a, b) {
			var aName, bName;
			for (c in a.Beziehungspartner) {
				if (Gruppe === "Lebensräume") {
					//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
					aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
				} else {
					aName = a.Beziehungspartner[c].Name;
				}
			}
			for (d in b.Beziehungspartner) {
				if (Gruppe === "Lebensräume") {
					bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
				} else {
					bName = b.Beziehungspartner[d].Name;
				}
			}
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		});
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (art) {
				//Datensammlung der Art zufügen
				if (!art.Beziehungen) {
					art.Beziehungen = [];
					art.Beziehungen.push(Datensammlung);
				} else {
					artDerBeziehungExistiertSchon = false;
					//kontrollieren, ob diese Art von Beziehungen schon existiert
					for (i in art.Beziehungen) {
						if (art.Beziehungen[i].Name === Datensammlung.Name) {
							artDerBeziehungExistiertSchon = true;
							//Beziehungen in vorhandener Datensammlung ergänzen
							art.Beziehungen[i].Beziehungen.push(Datensammlung.Beziehungen);
							//und neu sortieren
							art.Beziehungen[i].Beziehungen.sort(function(a, b) {
								var aName, bName;
								for (c in a.Beziehungspartner) {
									if (Gruppe === "Lebensräume") {
										//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
										aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
									} else {
										aName = a.Beziehungspartner[c].Name;
									}
								}
								for (d in b.Beziehungspartner) {
									if (Gruppe === "Lebensräume") {
										bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
									} else {
										bName = b.Beziehungspartner[d].Name;
									}
								}
								return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
							});
						}
					}
					if (!artDerBeziehungExistiertSchon) {
						//Datensammlung sammt Beziehung ergänzen
						art.Beziehungen.push(Datensammlung);
					}
				}
				//Datensammlungen nach Name sortieren
				art.Beziehungen.sort(function(a, b) {
					var aName = a.Name;
					var bName = b.Name;
					return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
				});
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
		for (f in window.tblLrLrBezSynonym_artenliste) {
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
		for (f in window.tblLrLrBezUntereinheitVon_artenliste) {
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
	//Felder der Datensammlung schreiben
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
			//Felder der Datensammlung schreiben
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
		Datensammlung.Beziehungen.sort(function(a, b) {
			var aName, bName;
			for (c in a.Beziehungspartner) {
				//sortiert werden soll bei Lebensräumen zuerst nach Taxonomie, dann nach Name
				aName = a.Beziehungspartner[c].Taxonomie + a.Beziehungspartner[c].Name;
			}
			for (d in b.Beziehungspartner) {
				bName = b.Beziehungspartner[d].Taxonomie + b.Beziehungspartner[d].Name;
			}
			return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
		});
		//jetzt die Art um diese Beziehung ergänzen
		$db = $.couch.db("artendb");
		$db.openDoc(GUID, {
			success: function (lr) {
				if (!lr.Beziehungen) {
					lr.Beziehungen = [];
				}
				lr.Beziehungen.push(Datensammlung);
				//Datensammlungen nach Name sortieren
				lr.Beziehungen.sort(function(a, b) {
					var aName = a.Name;
					var bName = b.Name;
					return (aName == bName) ? 0 : (aName > bName) ? 1 : -1;
				});
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
			for (i in DatensammlungenFlora) {
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
			for (i in DatensammlungFlora) {
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
		for (i in Datensatzobjekt.rows) {
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