function importiereFloraIndex(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Index, Art, anzDs, länge, andereArt, offizielleArt;
	//tblName wird ignoriert
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFloraSisf'");
	//Index importieren
	Index = frageSql(myDB, "SELECT * FROM tblFloraSisf_import");
	anzDs = 0;
	for (x in Index) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Art als Objekt gründen
			Art = {};
			//_id soll GUID sein, aber ohne Klammern
			Art._id = Index[x].GUID;
			Art.Gruppe = Index[x].Gruppe;
			//Datensammlung als Objekt gründen, heisst wie DsName
			Art[DatensammlungMetadaten[0].DsName] = {};
			Art[DatensammlungMetadaten[0].DsName].Typ = "Datensammlung";
			Art[DatensammlungMetadaten[0].DsName].Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				Art[DatensammlungMetadaten[0].DsName].Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				Art[DatensammlungMetadaten[0].DsName]["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			Art[DatensammlungMetadaten[0].DsName].Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			for (y in Index[x]) {
				if (Index[x][y] !== "" && Index[x][y] !== null && y !== "Gruppe") {
					if (Index[x][y] === -1) {
						//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = true;
					} else if (y === "Offizielle Art" || y === "Eingeschlossen in" || y === "Synonym von") {
						//Objekt aus Name und GUID bilden
						offizielleArt = {};
						andereArt = frageSql(myDB, "SELECT [Artname vollständig] as Artname FROM tblFloraSisf_import where GUID='" + Index[x][y] + "'");
						offizielleArt.GUID = Index[x][y];
						offizielleArt.Name = andereArt[0].Artname;
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = offizielleArt;
					} else {
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = Index[x][y];
					}
				}
			}
			$db = $.couch.db("artendb");
			$db.saveDoc(Art);
		}
	}
}

function ergänzeFloraDeutscheNamen() {
	var qryDeutscheNamen, myDB;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	qryDeutscheNamen = frageSql(myDB, "SELECT SisfNr, NOM_COMMUN FROM tblFloraSisfNomCommun INNER JOIN tblFloraSisfNomComTax ON tblFloraSisfNomCommun.NO_NOM_COMMUN = tblFloraSisfNomComTax.NO_NOM_COMMUN ORDER BY NOM_COMMUN");
	$db = $.couch.db("artendb");
	$db.view('artendb/flora?include_docs=true', {
		success: function (data) {
			for (i in data.rows) {
				var Art, ArtNr, deutscheNamen;
				Art = data.rows[i].doc;
				ArtNr = Art.Index.Felder["Index ID"];
				deutscheNamen = "";
				for (k in qryDeutscheNamen) {
					if (qryDeutscheNamen[k].SisfNr === ArtNr) {
						if (deutscheNamen) {
							deutscheNamen += ', ';
						}
						deutscheNamen += qryDeutscheNamen[k].NOM_COMMUN;
					}
				}
				if (deutscheNamen && deutscheNamen !== Art.Index.Felder["Deutsche Namen"]) {
					Art.Index.Felder["Deutsche Namen"] = deutscheNamen;
					$db = $.couch.db("artendb");
					$db.saveDoc(Art);
				}
			}
		}
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
				if (Art.Index.Felder["Gültige Namen"]) {
					Nrn = Art.Index.Felder["Gültige Namen"].split(",");
					gültigeNamen = [];
					for (a in Nrn) {
						for (k in data.rows) {
							if (data.rows[k].doc.Index.Felder["Index ID"] == parseInt(Nrn[a])) {
								gültigeArt = {};
								gültigeArt.GUID = data.rows[k].doc.Index.Felder.GUID;
								gültigeArt.Name = data.rows[k].doc.Index.Felder["Artname vollständig"];
								gültigeNamen.push(gültigeArt);
							}
						}
					}
					if (gültigeNamen !== []) {
						Art.Index.Felder["Gültige Namen"] = gültigeNamen;
						$db.saveDoc(Art);
					}
				}
			}
		}
	});
}

function ergänzeFloraEingeschlosseneArten() {
	var qryEingeschlosseneArten, myDB;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	qryEingeschlosseneArten = frageSql(myDB, "SELECT tblFloraSisfAggrSl.NO_AGR_SL, IIf([tblFloraSisf].[Deutsch] Is Not Null,[tblFloraSisf].[Name] & ' (' & [tblFloraSisf].[Deutsch] & ')',[tblFloraSisf].[Name]) AS [Artname vollständig], Mid([tblFloraSisf].[GUID],2,36) AS [GUID] FROM tblFloraSisfAggrSl INNER JOIN tblFloraSisf ON tblFloraSisfAggrSl.NO_NOM_INCLU = tblFloraSisf.NR");
	$db = $.couch.db("artendb");
	$db.view('artendb/flora?include_docs=true', {
		success: function (data) {
			//alert(JSON.stringify(qryEingeschlosseneArten));
			//alert(JSON.stringify(data));
			for (i in data.rows) {
				var Art, ArtNr, eingeschlosseneArten, eingeschlosseneArt;
				Art = data.rows[i].doc;
				//alert(JSON.stringify(Art));
				if (Art.Index.Felder["Eingeschlossene Arten"]) {
					//alert(JSON.stringify(Art));
					eingeschlosseneArten = [];
					for (k in qryEingeschlosseneArten) {
						if (qryEingeschlosseneArten[k].NO_AGR_SL === Art.Index.Felder["Index ID"]) {
							eingeschlosseneArt = {};
							eingeschlosseneArt.GUID = qryEingeschlosseneArten[k].GUID;
							eingeschlosseneArt.Name = qryEingeschlosseneArten[k]["Artname vollständig"];
							eingeschlosseneArten.push(eingeschlosseneArt);
						}
					}
					Art.Index.Felder["Eingeschlossene Arten"] = eingeschlosseneArten;
					$db.saveDoc(Art);
				}
			}
		}
	});
}

function ergänzeFloraSynonyme() {
	var qrySynonyme, myDB;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	qrySynonyme = frageSql(myDB, "SELECT tblFloraSisf.SynonymVon AS NR, Mid([tblFloraSisf].[GUID],2,36) AS Synonym_GUID, IIf([tblFloraSisf].[Deutsch] Is Not Null,[tblFloraSisf].[Name] & ' (' & [tblFloraSisf].[Deutsch] & ')',[tblFloraSisf].[Name]) AS Synonym_Name FROM tblFloraSisf WHERE tblFloraSisf.SynonymVon Is Not Null ORDER BY [tblFloraSisf].[Name]");
	$db = $.couch.db("artendb");
	$db.view('artendb/flora?include_docs=true', {
		success: function (data) {
			for (i in data.rows) {
				var Art, ArtNr, Synonyme, Synonym;
				Art = data.rows[i].doc;
				if (Art.Index.Felder.Synonyme) {
					Synonyme = [];
					for (k in qrySynonyme) {
						if (qrySynonyme[k].NR === Art.Index.Felder["Index ID"]) {
							Synonym = {};
							Synonym.GUID = qrySynonyme[k].Synonym_GUID;
							Synonym.Name = qrySynonyme[k].Synonym_Name;
							Synonyme.push(Synonym);
						}
					}
					Art.Index.Felder.Synonyme = Synonyme;
					$db.saveDoc(Art);
				}
			}
		}
	});
}

function importiereFloraDatensammlungen(tblName, Anz) {
	initiiereImport("importiereFloraDatensammlungen_02", tblName, Anz);
}

function importiereFloraDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, sqlDatensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	sqlDatensammlung = "SELECT * FROM " + tblName + "_import";
	Datensammlung = frageSql(myDB, sqlDatensammlung);
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 3000er Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Datensammlung als Objekt gründen
			DatensammlungDieserArt = {};
			DatensammlungDieserArt.Typ = "Datensammlung";
			DatensammlungDieserArt.Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				DatensammlungDieserArt.Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				DatensammlungDieserArt["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			DatensammlungDieserArt.Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			anzFelder = 0;
			for (y in Datensammlung[x]) {
				if (y !== "GUID" && y !== "NR" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null && y !== DatensammlungMetadaten[0].DsBeziehungsfeldDs && y !== "Gruppe") {
					if (Datensammlung[x][y] === -1) {
						//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
						DatensammlungDieserArt.Felder[y] = true;
					} else {
						//Normalfall
						DatensammlungDieserArt.Felder[y] = Datensammlung[x][y];
					}
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

function importiereMoosIndex(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Index, Art, anzDs, akzeptierteReferenz;
	//tblName wird ignoriert
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMooseNism'");
	//Index importieren
	Index = frageSql(myDB, "SELECT * FROM tblMooseNism_import");
	anzDs = 0;
	for (x in Index) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Art als Objekt gründen
			Art = {};
			//_id soll GUID sein, aber ohne Klammern
			Art._id = Index[x].GUID;
			Art.Gruppe = Index[x].Gruppe;
			//Datensammlung als Objekt gründen, heisst wie DsName
			Art[DatensammlungMetadaten[0].DsName] = {};
			Art[DatensammlungMetadaten[0].DsName].Typ = "Datensammlung";
			Art[DatensammlungMetadaten[0].DsName].Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				Art[DatensammlungMetadaten[0].DsName].Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				Art[DatensammlungMetadaten[0].DsName]["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			Art[DatensammlungMetadaten[0].DsName].Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			for (y in Index[x]) {
				if (Index[x][y] !== "" && Index[x][y] !== null && y !== "Gruppe") {
					if (y === "Akzeptierte Referenz") {
						//Objekt aus Name und GUID bilden
						akzeptierteReferenz = {};
						andereArt = frageSql(myDB, "SELECT [Artname vollständig] as Artname FROM tblMooseNism_import where GUID='" + Index[x][y] + "'");
						akzeptierteReferenz.GUID = Index[x][y];
						akzeptierteReferenz.Name = andereArt[0].Artname;
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = akzeptierteReferenz;
					} else if (Index[x][y] === -1) {
						//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = true;
					} else {
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = Index[x][y];
					}
				}
			}
			$db = $.couch.db("artendb");
			$db.saveDoc(Art);
		}
	}
}

function importiereMoosDatensammlungen(tblName, Anz) {
	initiiereImport("importiereMoosDatensammlungen_02", tblName, Anz);
}

function importiereMoosDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	Datensammlung = frageSql(myDB, "SELECT * FROM " + tblName + "_import");
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Datensammlung als Objekt gründen
			DatensammlungDieserArt = {};
			DatensammlungDieserArt.Typ = "Datensammlung";
			DatensammlungDieserArt.Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				DatensammlungDieserArt.Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				DatensammlungDieserArt["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			DatensammlungDieserArt.Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			anzFelder = 0;
			for (y in Datensammlung[x]) {
				if (y !== "GUID" && y !== "NR" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null && y !== DatensammlungMetadaten[0].DsBeziehungsfeldDs && y !== "Gruppe") {
					if (Datensammlung[x][y] === -1) {
						//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
						DatensammlungDieserArt.Felder[y] = true;
					} else {
						//Normalfall
						DatensammlungDieserArt.Felder[y] = Datensammlung[x][y];
					}
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

function importiereMacromycetesIndex(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Index, Art, anzDs;
	//tblName wird ignoriert
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMacromycetes'");
	//Index importieren
	Index = frageSql(myDB, "SELECT * FROM tblMacromycetes_import");
	anzDs = 0;
	for (x in Index) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Art als Objekt gründen
			Art = {};
			//_id soll GUID sein, aber ohne Klammern
			Art._id = Index[x].GUID;
			Art.Gruppe = Index[x].Gruppe;
			//Datensammlung als Objekt gründen, heisst wie DsName
			Art[DatensammlungMetadaten[0].DsName] = {};
			Art[DatensammlungMetadaten[0].DsName].Typ = "Datensammlung";
			Art[DatensammlungMetadaten[0].DsName].Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				Art[DatensammlungMetadaten[0].DsName].Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				Art[DatensammlungMetadaten[0].DsName]["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			Art[DatensammlungMetadaten[0].DsName].Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			for (y in Index[x]) {
				if (Index[x][y] !== "" && Index[x][y] !== null && y !== "Gruppe") {
					if (Index[x][y] === -1) {
						//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = true;
					} else {
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = Index[x][y];
					}
				}
			}
			$db = $.couch.db("artendb");
			$db.saveDoc(Art);
		}
	}
}

function importiereMacromycetesDatensammlungen(tblName, Anz) {
	initiiereImport("importiereMacromycetesDatensammlungen_02", tblName, Anz);
}

function importiereMacromycetesDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	Datensammlung = frageSql(myDB, "SELECT * FROM " + tblName + "_import");
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Datensammlung als Objekt gründen
			DatensammlungDieserArt = {};
			DatensammlungDieserArt.Typ = "Datensammlung";
			DatensammlungDieserArt.Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				DatensammlungDieserArt.Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				DatensammlungDieserArt["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			DatensammlungDieserArt.Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			anzFelder = 0;
			for (y in Datensammlung[x]) {
				if (y !== "GUID" && y !== "TaxonId" && y !== "tblMacromycetes.TaxonId" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null && y !== DatensammlungMetadaten[0].DsBeziehungsfeldDs && y !== "Gruppe") {
					if (Datensammlung[x][y] === -1) {
						//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
						DatensammlungDieserArt.Felder[y] = true;
					} else {
						//Normalfall
						DatensammlungDieserArt.Felder[y] = Datensammlung[x][y];
					}
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

function importiereFaunaIndex(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Index, Art, anzDs;
	//tblName wird ignoriert
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFaunaCscf'");
	//Index importieren
	Index = frageSql(myDB, "SELECT * FROM tblFaunaCscf_import");
	anzDs = 0;
	for (x in Index) {
		//In Häppchen von max. 2500 Datensätzen aufteilen
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 3000er Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Art als Objekt gründen
			Art = {};
			//_id soll GUID sein, aber ohne Klammern
			Art._id = Index[x].GUID;
			Art.Gruppe = Index[x].Gruppe;
			//Datensammlung als Objekt gründen, heisst wie DsName
			Art[DatensammlungMetadaten[0].DsName] = {};
			Art[DatensammlungMetadaten[0].DsName].Typ = "Datensammlung";
			Art[DatensammlungMetadaten[0].DsName].Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				Art[DatensammlungMetadaten[0].DsName].Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				Art[DatensammlungMetadaten[0].DsName]["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			Art[DatensammlungMetadaten[0].DsName].Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			for (y in Index[x]) {
				if (Index[x][y] !== "" && Index[x][y] !== null && y !== "Gruppe") {
					if (Index[x][y] === -1) {
						//Access wadelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = true;
					} else {
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = Index[x][y];
					}
				}
			}
			$db = $.couch.db("artendb");
			$db.saveDoc(Art);
		}
	}
}

function importiereFaunaDatensammlungen(tblName, Anz) {
	initiiereImport("importiereFaunaDatensammlungen_02", tblName, Anz);
}

function importiereFaunaDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen, mit GUID ergänzen
	Datensammlung = frageSql(myDB, "SELECT * FROM " + tblName + "_import");
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 3000er Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Datensammlung als Objekt gründen
			DatensammlungDieserArt = {};
			DatensammlungDieserArt.Typ = "Datensammlung";
			DatensammlungDieserArt.Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			if (DatensammlungMetadaten[0].DsDatenstand) {
				DatensammlungDieserArt.Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				DatensammlungDieserArt["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			DatensammlungDieserArt.Felder = {};
			//Felder anfügen, wenn sie Werte enthalten
			anzFelder = 0;
			for (y in Datensammlung[x]) {
				if (y !== "GUID" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null) {
					if (Datensammlung[x][y] === -1) {
						//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
						DatensammlungDieserArt.Felder[y] = true;
					} else {
						//Normalfall
						DatensammlungDieserArt.Felder[y] = Datensammlung[x][y];
					}
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
	myDB = new ACCESSdb(dbPfad, {showErrors:false});
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
	var DatensammlungenFlora, sqlDatensammlungenFlora, DatensammlungenFauna, sqlDatensammlungenFauna, DatensammlungenMoos, sqlDatensammlungenMoos, DatensmmlungenMacromycetes, sqlDatensammlungMacromycetes, myDB, html, qryAnzDs, anzDs, anzButtons;
	myDB = verbindeMitMdb();
	sqlDatensammlungenFlora = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblFloraSisf' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblFloraSisf' ORDER BY DsReihenfolge";
	DatensammlungenFlora = frageSql(myDB, sqlDatensammlungenFlora);
	if (DatensammlungenFlora) {
		html = "Flora Datensammlungen:<br>";
		for (i in DatensammlungenFlora) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenFlora[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenFlora[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
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
		html = "Fauna Datensammlungen:<br>";
		for (i in DatensammlungenFauna) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenFauna[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenFauna[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
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
		//jetzt Moos
		sqlDatensammlungenMoos = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblMooseNism' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblMooseNism' ORDER BY DsReihenfolge";
		DatensammlungenMoos = frageSql(myDB, sqlDatensammlungenMoos);
		html = "Moose Datensammlungen:<br>";
		for (i in DatensammlungenMoos) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenMoos[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenMoos[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='";
				html += DatensammlungenMoos[i].DsTabelle + y;
				html += "' name='SchaltflächeMoosDatensammlung' Tabelle='" + DatensammlungenMoos[i].DsTabelle;
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>";
				html += DatensammlungenMoos[i].DsName;
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenMoosDatensammlungen").html(html);
		//jetzt Macromycetes
		sqlDatensammlungenMacromycetes = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'tblMacromycetes' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'tblMacromycetes' ORDER BY DsReihenfolge";
		DatensammlungenMacromycetes = frageSql(myDB, sqlDatensammlungenMacromycetes);
		html = "Macromycetes Datensammlungen:<br>";
		for (i in DatensammlungenMacromycetes) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenMacromycetes[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenMacromycetes[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='";
				html += DatensammlungenMacromycetes[i].DsTabelle + y;
				html += "' name='SchaltflächeMacromycetesDatensammlung' Tabelle='" + DatensammlungenMacromycetes[i].DsTabelle;
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>";
				html += DatensammlungenMacromycetes[i].DsName;
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenMacromycetesDatensammlungen").html(html);
	} else {
		alert("Bitte den Pfad zur .mdb erfassen");
	}
}

function baueIndexSchaltflächenAuf() {
	var DatensammlungFlora, DatensammlungFauna, DatensammlungMoos, DatensammlungMacromycetes, myDB, html, qryAnzDs, anzDs, anzButtons;
	myDB = verbindeMitMdb();
	//zuerst Flora
	DatensammlungFlora = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFloraSisf'");
	if (DatensammlungFlora) {
		html = "";
		for (i in DatensammlungFlora) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(GUID) AS Anzahl FROM tblFloraSisf_import");
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='tblFloraSisf" + y;
				html += "' name='SchaltflächeFloraIndex' Tabelle='tblFloraSisf";
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>Flora Index";
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenFloraIndex").html(html);
		//jetzt Fauna
		DatensammlungFauna = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblFaunaCscf'");
		html = "";
		for (i in DatensammlungFauna) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(GUID) AS Anzahl FROM tblFaunaCscf_import");
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='tblFaunaCscf" + y;
				html += "' name='SchaltflächeFaunaIndex' Tabelle='tblFaunaCscf";
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>Fauna Index";
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenFaunaIndex").html(html);
		//jetzt Moos
		DatensammlungMoos = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMooseNism'");
		html = "";
		for (i in DatensammlungMoos) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(TAXONNO) AS Anzahl FROM tblMooseNism");
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='tblMooseNism" + y;
				html += "' name='SchaltflächeMoosIndex' Tabelle='tblMooseNism";
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>Moose Index";
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenMoosIndex").html(html);
		//jetzt Pilze
		DatensammlungMacromycetes = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'tblMacromycetes'");
		html = "";
		for (i in DatensammlungMacromycetes) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(GUID) AS Anzahl FROM tblMacromycetes");
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='tblMacromycetes" + y;
				html += "' name='SchaltflächeMacromycetesIndex' Tabelle='tblMacromycetes";
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>Macromycetes Index";
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenMacromycetesIndex").html(html);
	} else {
		alert("Bitte den Pfad zur .mdb erfassen");
	}
}