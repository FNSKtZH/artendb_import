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
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art[window.tblDatensammlungMetadaten[0].DsName] = {};
				Art[window.tblDatensammlungMetadaten[0].DsName].Typ = "Taxonomie";	//war: Datensammlung
				Art[window.tblDatensammlungMetadaten[0].DsName].Beschreibung = window.tblDatensammlungMetadaten[0].DsBeschreibung;
				if (window.tblDatensammlungMetadaten[0].DsDatenstand) {
					Art[window.tblDatensammlungMetadaten[0].DsName].Datenstand = window.tblDatensammlungMetadaten[0].DsDatenstand;
				}
				if (window.tblDatensammlungMetadaten[0].DsLink) {
					Art[window.tblDatensammlungMetadaten[0].DsName]["Link"] = window.tblDatensammlungMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art[window.tblDatensammlungMetadaten[0].DsName].Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblFloraSisf[x]) {
					if (window.tblFloraSisf[x][y] !== "" && window.tblFloraSisf[x][y] !== null && y !== "Gruppe") {
						if (window.tblFloraSisf[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art[window.tblDatensammlungMetadaten[0].DsName].Felder[y] = true;
						} else if (y === "Offizielle Art" || y === "Eingeschlossen in" || y === "Synonym von") {
							//Objekt aus Name und GUID bilden
							offizielleArt = {};
							andereArt = frageSql(window.myDB, "SELECT [Artname vollständig] as Artname FROM tblFloraSisf_import where GUID='" + window.tblFloraSisf[x][y] + "'");
							offizielleArt.GUID = window.tblFloraSisf[x][y];
							offizielleArt.Name = andereArt[0].Artname;
							Art[window.tblDatensammlungMetadaten[0].DsName].Felder[y] = offizielleArt;
						} else if (y !== "GUID") {
							//GUID ist _id, kein eigenes Feld
							Art[window.tblDatensammlungMetadaten[0].DsName].Felder[y] = window.tblFloraSisf[x][y];
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
					ArtNr = Art["Aktuelle Taxonomie"].Felder["Taxonomie ID"];
					deutscheNamen = "";
					for (k in qryDeutscheNamen) {
						if (qryDeutscheNamen[k].SisfNr === ArtNr) {
							if (deutscheNamen) {
								deutscheNamen += ', ';
							}
							deutscheNamen += qryDeutscheNamen[k].NOM_COMMUN;
						}
					}
					if (deutscheNamen && deutscheNamen !== Art["Aktuelle Taxonomie"].Felder["Deutsche Namen"]) {
						Art["Aktuelle Taxonomie"].Felder["Deutsche Namen"] = deutscheNamen;
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
			var Art, Nrn, gültigeNamen, gültigeArt;
			for (i in data.rows) {
				Art = data.rows[i].doc;
				//Liste aller Deutschen Namen bilden
				if (Art["Aktuelle Taxonomie"].Felder["Gültige Namen"]) {
					Nrn = Art["Aktuelle Taxonomie"].Felder["Gültige Namen"].split(",");
					gültigeNamen = [];
					for (a in Nrn) {
						for (k in data.rows) {
							if (data.rows[k].doc["Aktuelle Taxonomie"].Felder["Taxonomie ID"] == parseInt(Nrn[a])) {
								gültigeArt = {};
								gültigeArt.GUID = data.rows[k].doc["Aktuelle Taxonomie"].Felder.GUID;
								gültigeArt.Name = data.rows[k].doc["Aktuelle Taxonomie"].Felder["Artname vollständig"];
								gültigeNamen.push(gültigeArt);
							}
						}
					}
					if (gültigeNamen !== []) {
						Art["Aktuelle Taxonomie"].Felder["Gültige Namen"] = gültigeNamen;
						$db.saveDoc(Art);
					}
				}
			}
		}
	});
}

function ergänzeFloraEingeschlosseneArten() {
	$.when(initiiereImport()).then(function() {
		var qryEingeschlosseneArten;
		qryEingeschlosseneArten = frageSql(window.myDB, "SELECT tblFloraSisfAggrSl.NO_AGR_SL, IIf([tblFloraSisf].[Deutsch] Is Not Null,[tblFloraSisf].[Name] & ' (' & [tblFloraSisf].[Deutsch] & ')',[tblFloraSisf].[Name]) AS [Artname vollständig], Mid([tblFloraSisf].[GUID],2,36) AS [GUID] FROM tblFloraSisfAggrSl INNER JOIN tblFloraSisf ON tblFloraSisfAggrSl.NO_NOM_INCLU = tblFloraSisf.NR");
		$db = $.couch.db("artendb");
		$db.view('artendb/flora?include_docs=true', {
			success: function (data) {
				for (i in data.rows) {
					var Art, ArtNr, eingeschlosseneArten, eingeschlosseneArt;
					Art = data.rows[i].doc;
					if (Art["Aktuelle Taxonomie"].Felder["Eingeschlossene Arten"]) {
						eingeschlosseneArten = [];
						for (k in qryEingeschlosseneArten) {
							if (qryEingeschlosseneArten[k].NO_AGR_SL === Art["Aktuelle Taxonomie"].Felder["Taxonomie ID"]) {
								eingeschlosseneArt = {};
								eingeschlosseneArt.GUID = qryEingeschlosseneArten[k].GUID;
								eingeschlosseneArt.Name = qryEingeschlosseneArten[k]["Artname vollständig"];
								eingeschlosseneArten.push(eingeschlosseneArt);
							}
						}
						Art["Aktuelle Taxonomie"].Felder["Eingeschlossene Arten"] = eingeschlosseneArten;
						$db.saveDoc(Art);
					}
				}
			}
		});
	});
}

function ergänzeFloraSynonyme() {
	$.when(initiiereImport()).then(function() {
		var qrySynonyme;
		qrySynonyme = frageSql(window.myDB, "SELECT tblFloraSisf.SynonymVon AS NR, Mid([tblFloraSisf].[GUID],2,36) AS Synonym_GUID, IIf([tblFloraSisf].[Deutsch] Is Not Null,[tblFloraSisf].[Name] & ' (' & [tblFloraSisf].[Deutsch] & ')',[tblFloraSisf].[Name]) AS Synonym_Name FROM tblFloraSisf WHERE tblFloraSisf.SynonymVon Is Not Null ORDER BY [tblFloraSisf].[Name]");
		$db = $.couch.db("artendb");
		$db.view('artendb/flora?include_docs=true', {
			success: function (data) {
				for (i in data.rows) {
					var Art, ArtNr, Synonyme, Synonym;
					Art = data.rows[i].doc;
					if (Art["Aktuelle Taxonomie"].Felder.Synonyme) {
						Synonyme = [];
						for (k in qrySynonyme) {
							if (qrySynonyme[k].NR === Art["Aktuelle Taxonomie"].Felder["Taxonomie ID"]) {
								Synonym = {};
								Synonym.GUID = qrySynonyme[k].Synonym_GUID;
								Synonym.Name = qrySynonyme[k].Synonym_Name;
								Synonyme.push(Synonym);
							}
						}
						Art["Aktuelle Taxonomie"].Felder.Synonyme = Synonyme;
						$db.saveDoc(Art);
					}
				}
			}
		});
	});
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
				DatensammlungDieserArt.Typ = "Datensammlung";
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
				Art[window.DatensammlungMetadatenMoose[0].DsName] = {};
				Art[window.DatensammlungMetadatenMoose[0].DsName].Typ = "Taxonomie";	//war: Datensammlung
				Art[window.DatensammlungMetadatenMoose[0].DsName].Beschreibung = window.DatensammlungMetadatenMoose[0].DsBeschreibung;
				if (window.DatensammlungMetadatenMoose[0].DsDatenstand) {
					Art[window.DatensammlungMetadatenMoose[0].DsName].Datenstand = window.DatensammlungMetadatenMoose[0].DsDatenstand;
				}
				if (window.DatensammlungMetadatenMoose[0].DsLink) {
					Art[window.DatensammlungMetadatenMoose[0].DsName]["Link"] = window.DatensammlungMetadatenMoose[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art[window.DatensammlungMetadatenMoose[0].DsName].Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblMooseNism[x]) {
					if (window.tblMooseNism[x][y] !== "" && window.tblMooseNism[x][y] !== null && y !== "Gruppe") {
						if (y === "Akzeptierte Referenz") {
							//Objekt aus Name und GUID bilden
							akzeptierteReferenz = {};
							andereArt = frageSql(window.myDB, "SELECT [Artname vollständig] as Artname FROM tblMooseNism_import where GUID='" + window.tblMooseNism[x][y] + "'");
							akzeptierteReferenz.GUID = window.tblMooseNism[x][y];
							akzeptierteReferenz.Name = andereArt[0].Artname;
							Art[window.DatensammlungMetadatenMoose[0].DsName].Felder[y] = akzeptierteReferenz;
						} else if (window.tblMooseNism[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art[window.DatensammlungMetadatenMoose[0].DsName].Felder[y] = true;
						} else if (y !== "GUID") {
							Art[window.DatensammlungMetadatenMoose[0].DsName].Felder[y] = window.tblMooseNism[x][y];
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
				DatensammlungDieserArt.Typ = "Datensammlung";
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
				Art[window.MacromycetesMetadaten[0].DsName] = {};
				Art[window.MacromycetesMetadaten[0].DsName].Typ = "Taxonomie";	//war: Datensammlung
				Art[window.MacromycetesMetadaten[0].DsName].Beschreibung = window.MacromycetesMetadaten[0].DsBeschreibung;
				if (window.MacromycetesMetadaten[0].DsDatenstand) {
					Art[window.MacromycetesMetadaten[0].DsName].Datenstand = window.MacromycetesMetadaten[0].DsDatenstand;
				}
				if (window.MacromycetesMetadaten[0].DsLink) {
					Art[window.MacromycetesMetadaten[0].DsName]["Link"] = window.MacromycetesMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art[window.MacromycetesMetadaten[0].DsName].Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblMacromycetes[x]) {
					if (window.tblMacromycetes[x][y] !== "" && window.tblMacromycetes[x][y] !== null && y !== "Gruppe") {
						if (window.tblMacromycetes[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art[window.MacromycetesMetadaten[0].DsName].Felder[y] = true;
						} else if (y !== "GUID") {
							Art[window.MacromycetesMetadaten[0].DsName].Felder[y] = window.tblMacromycetes[x][y];
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
				DatensammlungDieserArt.Typ = "Datensammlung";
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
				Art[window.FaunaMetadaten[0].DsName] = {};
				Art[window.FaunaMetadaten[0].DsName].Typ = "Taxonomie";	//war: Datensammlung
				Art[window.FaunaMetadaten[0].DsName].Beschreibung = window.FaunaMetadaten[0].DsBeschreibung;
				if (window.FaunaMetadaten[0].DsDatenstand) {
					Art[window.FaunaMetadaten[0].DsName].Datenstand = window.FaunaMetadaten[0].DsDatenstand;
				}
				if (window.FaunaMetadaten[0].DsLink) {
					Art[window.FaunaMetadaten[0].DsName]["Link"] = window.FaunaMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art[window.FaunaMetadaten[0].DsName].Felder = {};
				//Felder anfügen, wenn sie Werte enthalten
				for (y in window.tblFaunaCscf[x]) {
					if (window.tblFaunaCscf[x][y] !== "" && window.tblFaunaCscf[x][y] !== null && y !== "Gruppe") {
						if (window.tblFaunaCscf[x][y] === -1) {
							//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art[window.FaunaMetadaten[0].DsName].Felder[y] = true;
						} else if (y !== "GUID") {
							Art[window.FaunaMetadaten[0].DsName].Felder[y] = window.tblFaunaCscf[x][y];
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
				DatensammlungDieserArt.Typ = "Datensammlung";
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
		var Art, anzDs;
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
				Art.Gruppe = "Lebensräume";
				//Bezeichnet den Typ des Dokuments. Objekt = Art oder Lebensaum. Im Gegensatz zu Beziehung
				Art.Typ = "Objekt";
				//Datensammlung als Objekt gründen, heisst wie DsName
				Art[window.LrMetadaten[0].DsName] = {};
				Art[window.LrMetadaten[0].DsName].Typ = "Taxonomie";	//war: Datensammlung
				if (Art[window.LrMetadaten[0].DsName].Beschreibung) {
					Art[window.LrMetadaten[0].DsName].Beschreibung = window.LrMetadaten[0].DsBeschreibung;
				}
				if (window.LrMetadaten[0].DsDatenstand) {
					Art[window.LrMetadaten[0].DsName].Datenstand = window.LrMetadaten[0].DsDatenstand;
				}
				if (window.LrMetadaten[0].DsLink) {
					Art[window.LrMetadaten[0].DsName]["Link"] = window.LrMetadaten[0].DsLink;
				}
				//Felder der Datensammlung als Objekt gründen
				Art[window.LrMetadaten[0].DsName].Felder = {};
				//Felder anfügen, wenn sie Werte enthalten. Gruppe ist schon eingefügt
				for (y in window.tblLr[x]) {
					if (window.tblLr[x][y] !== "" && window.tblLr[x][y] !== null && y !== "Gruppe") {
						if (window.tblLr[x][y] === -1) {
							//Access wandelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
							Art[window.LrMetadaten[0].DsName].Felder[y] = true;
						} else if (y === "Einheit-Nrn FNS von" || y === "Einheit-Nrn FNS bis") {
							//access hat irgendwie aus Zahlen Zeichen gemacht
							Art[window.LrMetadaten[0].DsName].Felder[y] = parseInt(window.tblLr[x][y]);
						} else if (y === "Beschreibung" && window.tblLr[x][y]) {
							//komische Inhalte ersetzen
							Art[window.LrMetadaten[0].DsName].Felder[y] = window.tblLr[x][y]
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
							Art[window.LrMetadaten[0].DsName].Felder[y] = window.tblLr[x][y];
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
		var qryEinheiten;
		//mit der mdb verbinden
		$db = $.couch.db("artendb");
		$db.view('artendb/lr?include_docs=true', {
			success: function (data) {
				for (i in data.rows) {
					var LR, Hierarchie, Objekt;
					LR = data.rows[i].doc;
					//Beim export wurde "path" in die Hierarchie geschrieben
					if (LR.Taxonomie.Felder.Hierarchie === "path") {
						Hierarchie = [];
						Objekt = {};
						if (LR.Taxonomie.Felder.Label) {
							Objekt.Name = LR.Taxonomie.Felder.Label + ": " + LR.Taxonomie.Felder.Einheit;
						} else {
							Objekt.Name = LR.Taxonomie.Felder.Einheit;
						}
						Objekt.GUID = LR._id;
						Hierarchie.push(Objekt);
						//hierarchie schon mal setzen, weil beim obersten node das sonst nicht mehr passiert
						//bei anderen nodes wird dieser Wert später überschrieben
						LR.Taxonomie.Felder.Hierarchie = Hierarchie;
						if (typeof LR.Taxonomie.Felder.Parent === "objekt") {
							//Parent wurde schon umgewandelt, ist jetzt Objekt
							//Wenn id = Parent, ist das der oberste node. Dann nicht mehr weitermachen
							if (LR._id !== LR.Taxonomie.Felder.Parent.GUID) {
								LR.Taxonomie.Felder.Hierarchie = ergänzeParentZuHierarchie(data, LR.Taxonomie.Felder.Parent.GUID, Hierarchie);
							}
						} else {
							//Parent ist noch ein GUID
							//Wenn id = Parent, ist das der oberste node. Dann nicht mehr weitermachen
							if (LR._id !== LR.Taxonomie.Felder.Parent) {
								LR.Taxonomie.Felder.Hierarchie = ergänzeParentZuHierarchie(data, LR.Taxonomie.Felder.Parent, Hierarchie);
							}
						}
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
		var LR, parentObjekt;
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
				if (typeof LR.Taxonomie.Felder.Parent === "objekt") {
					//Parent wurde schon umgewandelt, ist jetzt Objekt
					return ergänzeParentZuHierarchie(Lebensräume, LR.Taxonomie.Felder.Parent.GUID, Hierarchie);
				} else {
					//Parent ist noch ein GUID
					return ergänzeParentZuHierarchie(Lebensräume, LR.Taxonomie.Felder.Parent, Hierarchie);
				}
			} else {
				//jetzt ist die Hierarchie vollständig
				//sie ist aber verkehrt - umkehren
				return Hierarchie.reverse();
				//return Hierarchie;
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
				DatensammlungDieserArt.Typ = "Datensammlung";
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
			doc[DsName] = DatensammlungDieserArt;
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
	$.when(initiiereImport()).then(function() {
		var Beziehung, anzDs, anzDsMax;
		//Informationen zur Datensammlung holen
		if (!window["DatensammlungMetadaten" + tblName]) {
			window["DatensammlungMetadaten" + tblName] = frageSql(window.myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
		}
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window["tblFloraFaunaBez" + tblName]) {
			window["tblFloraFaunaBez" + tblName] = frageSql(window.myDB, "SELECT * FROM tblFloraFaunaBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName][0].DsTabelle + "'");
		}
		anzDs = 0;
		for (x in window["tblFloraFaunaBez" + tblName]) {
			//In Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs-window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs)) {
				//Beziehung als Objekt gründen
				Beziehung = {};
				Beziehung._id = window["tblFloraFaunaBez" + tblName][x].GUID;
				//Bezeichnet den Typ des Dokuments
				Beziehung.Typ = "Beziehung";

				//Arten aufbauen, dann als Beziehungspartner anfügen
				Beziehung.Partner = [];
				var Flora = {};
				Flora.Gruppe = "Flora";
				Flora.Name = window["tblFloraFaunaBez" + tblName][x]["Flora Name"];
				Flora.GUID = window["tblFloraFaunaBez" + tblName][x]["Flora GUID"];
				Beziehung.Partner.push(Flora);
				var Fauna = {};
				Fauna.Gruppe = "Fauna";
				Fauna.Name = window["tblFloraFaunaBez" + tblName][x]["Fauna Name"];
				Fauna.GUID = window["tblFloraFaunaBez" + tblName][x]["Fauna GUID"];
				Beziehung.Partner.push(Fauna);
				
				//Datensammlung schreiben
				Beziehung.Datensammlung = {};
				Beziehung.Datensammlung.Name = window["tblFloraFaunaBez" + tblName][x].DsBeziehung;
				Beziehung.Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName][0].DsDatenstand) {
					Beziehung.Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName][0].DsLink) {
					Beziehung.Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName][0].DsLink;
				}

				//Felder der Datensammlung schreiben, wenn sie Werte enthalten
				Beziehung.Felder = {};
				var Feldnamen = ["Imago", "Larve", "Ei"];
				$.each(Feldnamen, function(index, value) {
					if (window["tblFloraFaunaBez" + tblName][x][value] !== "" && window["tblFloraFaunaBez" + tblName][x][value] !== null) {
						Beziehung.Felder[value] = window["tblFloraFaunaBez" + tblName][x][value];
					}
				});

				//speichern
				$db = $.couch.db("artendb");
				$db.saveDoc(Beziehung);
				if (anzDs === Anz*window["DatensammlungMetadaten" + tblName][0].DsAnzDs || anzDs === window["tblFloraFaunaBez" + tblName].length) {
					console.log("Import fertig: anzDs = " + anzDs);
				}
			}
		}
	});
}

function importiereLrFaunaBeziehungen(tblName, beziehung_nr, Anz) {
	$.when(initiiereImport()).then(function() {
		var Beziehung, anzDs, anzDsMax;
		//Informationen zur Datensammlung holen
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND Beziehungen=1 AND BeziehungNr=" + beziehung_nr);
		}
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window["tblLrFaunaBez" + tblName + beziehung_nr]) {
			window["tblLrFaunaBez" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM tblLrFaunaBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		anzDs = 0;
		for (x in window["tblLrFaunaBez" + tblName + beziehung_nr]) {
			//In Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 4000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs-window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs)) {
				//Beziehung als Objekt gründen
				Beziehung = {};
				Beziehung._id = window["tblLrFaunaBez" + tblName + beziehung_nr][x].GUID;
				//Bezeichnet den Typ des Dokuments
				Beziehung.Typ = "Beziehung";

				//Arten aufbauen, dann als Beziehungspartner anfügen
				Beziehung.Partner = [];
				var LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR Taxonomie"];
				LR.Name = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR Name"];
				LR.GUID = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["LR GUID"];
				Beziehung.Partner.push(LR);
				var Fauna = {};
				Fauna.Gruppe = "Fauna";
				Fauna.Name = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["Fauna Name"];
				Fauna.GUID = window["tblLrFaunaBez" + tblName + beziehung_nr][x]["Fauna GUID"];
				Beziehung.Partner.push(Fauna);
				
				//Datensammlung schreiben
				Beziehung.Datensammlung = {};
				Beziehung.Datensammlung.Name = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsName + ": " + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].Beziehung;
				Beziehung.Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand) {
					Beziehung.Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink) {
					Beziehung.Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink;
				}

				//Felder der Datensammlung schreiben, wenn sie Werte enthalten
				Beziehung.Felder = {};
				var Feldnamen = ["Art der Beziehung", "Wert für die Beziehung", "Bemerkungen"];
				$.each(Feldnamen, function(index, value) {
					//Leerwerte ausschliessen, aber nicht die 0
					if (window["tblLrFaunaBez" + tblName + beziehung_nr][x][value] !== "" && window["tblLrFaunaBez" + tblName + beziehung_nr][x][value] !== null) {
						//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
						if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle === "tblFaunaFnsApFm") {
							Beziehung.Felder.Biotopbindung = window["tblLrFaunaBez" + tblName + beziehung_nr][x][value];
						} else {
							Beziehung.Felder[value] = window["tblLrFaunaBez" + tblName + beziehung_nr][x][value];
						}
					}
				});

				//speichern
				$db = $.couch.db("artendb");
				$db.saveDoc(Beziehung);
				if (anzDs === Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs || anzDs === window["tblLrFaunaBez" + tblName + beziehung_nr].length) {
					console.log("Import fertig: anzDs = " + anzDs);
				}
			}
		}
	});
}

function importiereLrFloraBeziehungen(tblName, beziehung_nr, Anz) {
	$.when(initiiereImport()).then(function() {
		var Beziehung, anzDs, anzDsMax;
		//Informationen zur Datensammlung holen
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND BeziehungNr=" + beziehung_nr);
		}
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window["tblLrFloraBez" + tblName + beziehung_nr]) {
			window["tblLrFloraBez" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM tblLrFloraBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		anzDs = 0;
		for (x in window["tblLrFloraBez" + tblName + beziehung_nr]) {
			//In Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 4000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs-window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs)) {
				//Beziehung als Objekt gründen
				Beziehung = {};
				Beziehung._id = window["tblLrFloraBez" + tblName + beziehung_nr][x].GUID;
				//Bezeichnet den Typ des Dokuments
				Beziehung.Typ = "Beziehung";

				//Arten aufbauen, dann als Beziehungspartner anfügen
				Beziehung.Partner = [];
				var LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = window["tblLrFloraBez" + tblName + beziehung_nr][x]["LR Taxonomie"];
				LR.Name = window["tblLrFloraBez" + tblName + beziehung_nr][x]["LR Name"];
				LR.GUID = window["tblLrFloraBez" + tblName + beziehung_nr][x]["LR GUID"];
				Beziehung.Partner.push(LR);
				var Flora = {};
				Flora.Gruppe = "Flora";
				Flora.Name = window["tblLrFloraBez" + tblName + beziehung_nr][x]["Flora Name"];
				Flora.GUID = window["tblLrFloraBez" + tblName + beziehung_nr][x]["Flora GUID"];
				Beziehung.Partner.push(Flora);
				
				//Datensammlung schreiben
				Beziehung.Datensammlung = {};
				Beziehung.Datensammlung.Name = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsName + ": " + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].Beziehung;
				Beziehung.Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand) {
					Beziehung.Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink) {
					Beziehung.Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink;
				}

				//Felder der Datensammlung schreiben, wenn sie Werte enthalten
				Beziehung.Felder = {};
				var Feldnamen = ["Art der Beziehung", "Wert für die Beziehung", "Bemerkungen"];
				$.each(Feldnamen, function(index, value) {
					//Leerwerte ausschliessen, aber nicht die 0
					if (window["tblLrFloraBez" + tblName + beziehung_nr][x][value] !== "" && window["tblLrFloraBez" + tblName + beziehung_nr][x][value] !== null) {
						//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
						if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle === "tblFloraFnsApFm") {
							Beziehung.Felder.Biotopbindung = window["tblLrFloraBez" + tblName + beziehung_nr][x][value];
						} else {
							Beziehung.Felder[value] = window["tblLrFloraBez" + tblName + beziehung_nr][x][value];
						}
					}
				});

				//speichern
				$db = $.couch.db("artendb");
				$db.saveDoc(Beziehung);
				if (anzDs === Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs || anzDs === window["tblLrFloraBez" + tblName + beziehung_nr].length) {
					console.log("Import fertig: anzDs = " + anzDs);
				}
			}
		}
	});
}

function importiereLrMooseBeziehungen(tblName, beziehung_nr, Anz) {
	$.when(initiiereImport()).then(function() {
		var Beziehung, anzDs, anzDsMax;
		//Informationen zur Datensammlung holen
		if (!window["DatensammlungMetadaten" + tblName + beziehung_nr]) {
			window["DatensammlungMetadaten" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM qryBezMetadaten WHERE DsTabelle = '" + tblName + "' AND BeziehungNr=" + beziehung_nr);
		}
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window["tblLrMooseBez" + tblName + beziehung_nr]) {
			window["tblLrMooseBez" + tblName + beziehung_nr] = frageSql(window.myDB, "SELECT * FROM tblLrMooseBez_import WHERE DsTabelle='" + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle + "' AND BeziehungNr=" + beziehung_nr);
		}
		anzDs = 0;
		for (x in window["tblLrMooseBez" + tblName + beziehung_nr]) {
			//In Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 4000er Batches
			if ((anzDs > (Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs-window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs)) && (anzDs <= Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs)) {
				//Beziehung als Objekt gründen
				Beziehung = {};
				Beziehung._id = window["tblLrMooseBez" + tblName + beziehung_nr][x].GUID;
				//Bezeichnet den Typ des Dokuments
				Beziehung.Typ = "Beziehung";

				//Arten aufbauen, dann als Beziehungspartner anfügen
				Beziehung.Partner = [];
				var LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR Taxonomie"];
				LR.Name = window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR Name"];
				LR.GUID = window["tblLrMooseBez" + tblName + beziehung_nr][x]["LR GUID"];
				Beziehung.Partner.push(LR);
				var Moose = {};
				Moose.Gruppe = "Moose";
				Moose.Name = window["tblLrMooseBez" + tblName + beziehung_nr][x]["Moos Name"];
				Moose.GUID = window["tblLrMooseBez" + tblName + beziehung_nr][x]["Moos GUID"];
				Beziehung.Partner.push(Moose);
				
				//Datensammlung schreiben
				Beziehung.Datensammlung = {};
				Beziehung.Datensammlung.Name = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsName + ": " + window["DatensammlungMetadaten" + tblName + beziehung_nr][0].Beziehung;
				Beziehung.Datensammlung.Beschreibung = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsBeschreibung;
				if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand) {
					Beziehung.Datensammlung.Datenstand = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsDatenstand;
				}
				if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink) {
					Beziehung.Datensammlung["Link"] = window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsLink;
				}

				//Felder der Datensammlung schreiben, wenn sie Werte enthalten
				Beziehung.Felder = {};
				var Feldnamen = ["Art der Beziehung", "Wert für die Beziehung", "Bemerkungen"];
				$.each(Feldnamen, function(index, value) {
					//Leerwerte ausschliessen, aber nicht die 0
					if (window["tblLrMooseBez" + tblName + beziehung_nr][x][value] !== "" && window["tblLrMooseBez" + tblName + beziehung_nr][x][value] !== null) {//Bei AP FM soll das Feld "Wert für die Beziehung" "Biotopbindung" heissen
						if (window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsTabelle === "tblMooseFnsApFm") {
							Beziehung.Felder.Biotopbindung = window["tblLrMooseBez" + tblName + beziehung_nr][x][value];
						} else {
							Beziehung.Felder[value] = window["tblLrMooseBez" + tblName + beziehung_nr][x][value];
						}
					}
				});

				//speichern
				$db = $.couch.db("artendb");
				$db.saveDoc(Beziehung);
				if (anzDs === Anz*window["DatensammlungMetadaten" + tblName + beziehung_nr][0].DsAnzDs || anzDs === window["tblLrMooseBez" + tblName + beziehung_nr].length) {
					console.log("Import fertig: anzDs = " + anzDs);
				}
			}
		}
	});
}

function importiereLrLrBeziehungen(Anz) {
	$.when(initiiereImport()).then(function() {
		var Beziehung, anzDs;
		//keine Informationen zu Datensammlungen vorhanden
		//Beziehungen importieren, aber nur, wenn nicht schon vorhanden
		if (!window.tblLrLrBez) {
			window.tblLrLrBez = frageSql(window.myDB, "SELECT * FROM qryLrLrBez_import");
		}
		anzDs = 0;
		for (x in window.tblLrLrBez) {
			//In Häppchen aufteilen
			anzDs += 1;
			//nur importieren, wenn innerhalb des mit Anz übergebenen 4000er Batches
			if ((anzDs > (Anz*4000-4000)) && (anzDs <= Anz*4000)) {
				//Beziehung als Objekt gründen
				Beziehung = {};
				Beziehung._id = window.tblLrLrBez[x].GUID;
				//Bezeichnet den Typ des Dokuments
				Beziehung.Typ = "Beziehung";

				//Arten aufbauen, dann als Beziehungspartner anfügen
				Beziehung.Partner = [];
				var LR = {};
				LR.Gruppe = "Lebensräume";
				LR.Taxonomie = window.tblLrLrBez[x]["LR1 Taxonomie"];
				LR.Name = window.tblLrLrBez[x]["LR1 Name"];
				LR.GUID = window.tblLrLrBez[x]["LR1 GUID"];
				Beziehung.Partner.push(LR);
				var LR2 = {};
				LR2.Gruppe = "Lebensräume";
				LR2.Taxonomie = window.tblLrLrBez[x]["LR2 Taxonomie"];
				LR2.Name = window.tblLrLrBez[x]["LR2 Name"];
				LR2.GUID = window.tblLrLrBez[x]["LR2 GUID"];
				Beziehung.Partner.push(LR2);
				
				//Datensammlung schreiben
				Beziehung.Datensammlung = {};
				if (window.tblLrLrBez[x]["Art der Beziehung"] === "Synonym von") {
					Beziehung.Datensammlung.Name = "Synonyme Lebensräume";
				} else if (window.tblLrLrBez[x]["Art der Beziehung"] === "Untereinheit von") {
					Beziehung.Datensammlung.Name = "Hierarchisch über-/untergeordnete Lebensräume";
				} else {
					Beziehung.Datensammlung.Name = "Beziehungen zu anderen Lebensräumen";
				}
				Beziehung.Datensammlung.Beschreibung = "Diese Datensammlung ist nicht beschrieben";

				//Felder der Datensammlung schreiben, wenn sie Werte enthalten
				//Es gibt nur das Feld "Art der Beziehung"
				Beziehung.Felder = {};
				//es gibt keine Leerwerte
				if (window.tblLrLrBez[x]["Art der Beziehung"] === "Synonym von") {
					Beziehung.Felder["Art der Beziehung"] = "synonym";
				} else {
					//Wert ist "Untereinheit von"
					Beziehung.Felder["Art der Beziehung"] = "hierarchisch";
					Beziehung.Felder["übergeordnete Einheit"] = LR2;
					Beziehung.Felder["untergeordnete Einheit"] = LR;
				}

				//speichern
				$db = $.couch.db("artendb");
				$db.saveDoc(Beziehung);
				if (anzDs === Anz*4000 || anzDs === window.tblLrLrBez.length) {
					console.log("Import fertig: anzDs = " + anzDs);
				}
			}
		}
	});
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
	a = JSON.stringify(qry);
	//Rückgabewert ist in "" eingepackt > entfernen
	b = a.slice(1, a.length -1);
	//im Rückgabewert sind alle " mit \" ersetzt. Das ist kein valid JSON!
	c = b.replace(/\\\"/gm, "\"");
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

			//jetzt Flora-Bauna-Beziehungen
			sqlDatensammlungenFloraFaunaBez = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex='tblFloraFaunaBez' ORDER BY DsReihenfolge";
			DatensammlungenFloraFaunaBez = frageSql(window.myDB, sqlDatensammlungenFloraFaunaBez);
			html = "";
			for (i in DatensammlungenFloraFaunaBez) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(*) AS Anzahl FROM tblFloraFaunaBez_import WHERE DsTabelle='" + DatensammlungenFloraFaunaBez[i].DsTabelle + "'");
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenFloraFaunaBez[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenFloraFaunaBez[i].DsTabelle + y;
					html += "' name='FloraFaunaBez' Tabelle='" + DatensammlungenFloraFaunaBez[i].DsTabelle;
					html += "' Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenFloraFaunaBez[i].DsName;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenFloraFaunaBez").html(html);

			//jetzt LR-Fauna-Beziehungen
			sqlDatensammlungenLrFaunaBez = "SELECT * FROM qryBezMetadaten WHERE DsIndex='tblFaunaCscf' ORDER BY DsReihenfolge";
			DatensammlungenLrFaunaBez = frageSql(window.myDB, sqlDatensammlungenLrFaunaBez);
			html = "";
			for (i in DatensammlungenLrFaunaBez) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(*) AS Anzahl FROM tblLrFaunaBez_import WHERE DsTabelle='" + DatensammlungenLrFaunaBez[i].DsTabelle + "' AND BeziehungNr=" + DatensammlungenLrFaunaBez[i].BeziehungNr);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenLrFaunaBez[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenLrFaunaBez[i].DsTabelle + DatensammlungenLrFaunaBez[i].BeziehungNr + y;
					html += "' name='LrFaunaBez' Tabelle='" + DatensammlungenLrFaunaBez[i].DsTabelle;
					html += "' BeziehungNr=" + DatensammlungenLrFaunaBez[i].BeziehungNr + " Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenLrFaunaBez[i].DsName + ": " + qryAnzDs[0].Anzahl + " " + DatensammlungenLrFaunaBez[i].Beziehung;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenLrFaunaBez").html(html);

			//jetzt LR-Flora-Beziehungen
			sqlDatensammlungenLrFloraBez = "SELECT * FROM qryBezMetadaten WHERE DsIndex='tblFloraSisf' ORDER BY DsReihenfolge";
			DatensammlungenLrFloraBez = frageSql(window.myDB, sqlDatensammlungenLrFloraBez);
			html = "";
			for (i in DatensammlungenLrFloraBez) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(*) AS Anzahl FROM tblLrFloraBez_import WHERE DsTabelle='" + DatensammlungenLrFloraBez[i].DsTabelle + "' AND BeziehungNr=" + DatensammlungenLrFloraBez[i].BeziehungNr);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenLrFloraBez[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenLrFloraBez[i].DsTabelle + DatensammlungenLrFloraBez[i].BeziehungNr + y;
					html += "' name='LrFloraBez' Tabelle='" + DatensammlungenLrFloraBez[i].DsTabelle;
					html += "' BeziehungNr=" + DatensammlungenLrFloraBez[i].BeziehungNr + " Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenLrFloraBez[i].DsName + ": " + qryAnzDs[0].Anzahl + " " + DatensammlungenLrFloraBez[i].Beziehung;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenLrFloraBez").html(html);

			//jetzt LR-Moose-Beziehungen
			sqlDatensammlungenLrMooseBez = "SELECT * FROM qryBezMetadaten WHERE DsIndex='tblMooseNism' ORDER BY DsReihenfolge";
			DatensammlungenLrMooseBez = frageSql(window.myDB, sqlDatensammlungenLrMooseBez);
			html = "";
			for (i in DatensammlungenLrMooseBez) {
				//Anzahl Datensätze ermitteln
				qryAnzDs = frageSql(window.myDB, "SELECT Count(*) AS Anzahl FROM tblLrMooseBez_import WHERE DsTabelle='" + DatensammlungenLrMooseBez[i].DsTabelle + "' AND BeziehungNr=" + DatensammlungenLrMooseBez[i].BeziehungNr);
				anzDs = qryAnzDs[0].Anzahl;
				anzButtons = Math.ceil(anzDs/DatensammlungenLrMooseBez[i].DsAnzDs);
				for (y = 1; y <= anzButtons; y++) {
					html += "<input type='checkbox' id='";
					html += DatensammlungenLrMooseBez[i].DsTabelle + DatensammlungenLrMooseBez[i].BeziehungNr + y;
					html += "' name='LrMooseBez' Tabelle='" + DatensammlungenLrMooseBez[i].DsTabelle;
					html += "' BeziehungNr=" + DatensammlungenLrMooseBez[i].BeziehungNr + " Anz='" + y + "' Von='" + anzButtons;
					html += "'>";
					html += DatensammlungenLrMooseBez[i].DsName + ": " + qryAnzDs[0].Anzahl + " " + DatensammlungenLrMooseBez[i].Beziehung;
					if (anzButtons > 1) {
						html += " (" + y + "/" + anzButtons + ")";
					}
					html += "<br>";
				}
			}
			$("#SchaltflächenLrMooseBez").html(html);

			//jetzt LR-LR-Beziehungen
			html = "";
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(window.myDB, "SELECT Count(*) AS Anzahl FROM qryLrLrBez_import");
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/4000);
			for (y = 1; y <= anzButtons; y++) {
				html += "<input type='checkbox' id='";
				html += y;
				html += "' name='LrLrBez'";
				html += " Anz='" + y + "' Von='" + anzButtons;
				html += "'>";
				html += "LrLrBez: " + qryAnzDs[0].Anzahl;
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "<br>";
			}
			$("#SchaltflächenLrLrBez").html(html);

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