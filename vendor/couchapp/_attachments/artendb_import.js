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
			//_id soll GUID sein
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
			for (i in data.rows) {
				var Art, ArtNr, eingeschlosseneArten, eingeschlosseneArt;
				Art = data.rows[i].doc;
				if (Art.Index.Felder["Eingeschlossene Arten"]) {
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
	//Datensätze der Datensammlung abfragen
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
			//_id soll GUID sein
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
	//Datensätze der Datensammlung abfragen
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
			//_id soll GUID sein
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
	//Datensätze der Datensammlung abfragen
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
			//_id soll GUID sein
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
	//Datensätze der Datensammlung abfragen
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

function importiereLrIndex(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Index, Art, anzDs, Parent, parentArt, parentObjekt, Objekt, Hierarchie;
	//tblName wird ignoriert
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'LR'");
	//Index importieren
	Index = frageSql(myDB, "SELECT * FROM LR_import");
	anzDs = 0;
	for (x in Index) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Art als Objekt gründen
			Art = {};
			//_id soll GUID sein
			Art._id = Index[x].GUID;
			Art.Gruppe = Index[x].Gruppe;
			//Datensammlung als Objekt gründen, heisst wie DsName
			Art[DatensammlungMetadaten[0].DsName] = {};
			Art[DatensammlungMetadaten[0].DsName].Typ = "Datensammlung";
			if (Art[DatensammlungMetadaten[0].DsName].Beschreibung) {
				Art[DatensammlungMetadaten[0].DsName].Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			}
			if (DatensammlungMetadaten[0].DsDatenstand) {
				Art[DatensammlungMetadaten[0].DsName].Datenstand = DatensammlungMetadaten[0].DsDatenstand;
			}
			if (DatensammlungMetadaten[0].DsLink) {
				Art[DatensammlungMetadaten[0].DsName]["Link"] = DatensammlungMetadaten[0].DsLink;
			}
			//Felder der Datensammlung als Objekt gründen
			Art[DatensammlungMetadaten[0].DsName].Felder = {};
			//Felder anfügen, wenn sie Werte enthalten. Gruppe ist schon eingefügt
			for (y in Index[x]) {
				if (Index[x][y] !== "" && Index[x][y] !== null && y !== "Gruppe") {
					if (Index[x][y] === -1) {
						//Access wandelt in Abfragen Felder mit Wenn() in Zahlen um. Umkehren
						Art[DatensammlungMetadaten[0].DsName].Felder[y] = true;
					/*} else if (y === "Hierarchie") {
						Hierarchie = [];
						Objekt = {};
						if (Index[x].Label) {
							Objekt.Name = Index[x].Label + ": " + Index[x].Einheit;
						} else {
							Objekt.Name = Index[x].Einheit;
						}
						Objekt.GUID = Index[x].GUID;
						Hierarchie.push(Objekt);
						if (Index[x].Parent) {
							Art[DatensammlungMetadaten[0].DsName].Felder[y] = holeLrHierarchie(myDB, Index[x].GUID, Hierarchie);
						} else {
							//Kein Parent
							Art[DatensammlungMetadaten[0].DsName].Felder[y] = Hierarchie;
						}*/
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

function aktualisiereLrHierarchie() {
	var qryEinheiten, myDB;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	$db = $.couch.db("artendb");
	$db.view('artendb/lr?include_docs=true', {
		success: function (data) {
			for (i in data.rows) {
				var LR, Hierarchie, Objekt;
				LR = data.rows[i].doc;
				//Beim export wurde "path" in die Hierarchie geschrieben
				if (LR.Methode.Felder.Hierarchie && LR.Methode.Felder.Hierarchie === "path") {
					Hierarchie = [];
					Objekt = {};
					if (LR.Methode.Felder.Label) {
						Objekt.Name = LR.Methode.Felder.Label + ": " + LR.Methode.Felder.Einheit;
					} else {
						Objekt.Name = LR.Methode.Felder.Einheit;
					}
					Objekt.GUID = LR._id;
					Hierarchie.push(Objekt);
					if (LR.Methode.Felder.Parent) {
						if (typeof LR.Methode.Felder.Parent === "objekt") {
							//Parent wurde schon umgewandelt, ist jetzt Objekt
							LR.Methode.Felder.Hierarchie = ergänzeParentZuHierarchie(data, LR.Methode.Felder.Parent.GUID, Hierarchie);
						} else {
							//Parent ist noch ein GUID
							LR.Methode.Felder.Hierarchie = ergänzeParentZuHierarchie(data, LR.Methode.Felder.Parent, Hierarchie);
						}
					} else {
						//Kein Parent
						LR.Methode.Felder.Hierarchie = Hierarchie;
					}
					$db.saveDoc(LR);
				}
			}
		}
	});
}

//Baut den Hierarchiepfad für einen Lebensraum auf
//das erste Element - der Lebensraum selbst - wird mit der Variable "Hierarchie" übergeben
//ruft sich selbst rekursiv auf, bis das oberste Hierarchieelement erreicht ist
function ergänzeParentZuHierarchie(Lebensräume, parentGUID, Hierarchie) {
	for (i in Lebensräume.rows) {
		var LR, Hierarchie, parentObjekt;
		LR = Lebensräume.rows[i].doc;
		if (LR._id === parentGUID) {
			parentObjekt = {};
			if (LR.Methode.Felder.Label) {
				parentObjekt.Name = LR.Methode.Felder.Label + ": " + LR.Methode.Felder.Einheit;
			} else {
				parentObjekt.Name = LR.Methode.Felder.Einheit;
			}
			parentObjekt.GUID = LR._id;
			Hierarchie.push(parentObjekt);
			if (LR.Methode.Felder.Parent) {
				//die Hierarchie ist noch nicht zu Ende - weitermachen
				if (typeof LR.Methode.Felder.Parent === "objekt") {
					//Parent wurde schon umgewandelt, ist jetzt Objekt
					return ergänzeParentZuHierarchie(Lebensräume, LR.Methode.Felder.Parent.GUID, Hierarchie);
				} else {
					//Parent ist noch ein GUID
					return ergänzeParentZuHierarchie(Lebensräume, LR.Methode.Felder.Parent, Hierarchie);
				}
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
	var qryEinheiten, myDB;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	qryEinheiten = frageSql(myDB, "SELECT GUID, Einheit FROM LR_import");
	$db = $.couch.db("artendb");
	$db.view('artendb/lr?include_docs=true', {
		success: function (data) {
			for (i in data.rows) {
				var LR, Parent;
				LR = data.rows[i].doc;
				if (LR.Methode.Felder.Parent) {
					for (k in qryEinheiten) {
						if (qryEinheiten[k].GUID === LR.Methode.Felder.GUID) {
							Parent = {};
							Parent.GUID = qryEinheiten[k].GUID;
							Parent.Name = qryEinheiten[k].Einheit;
							break;
						}
					}
					LR.Methode.Felder.Parent = Parent;
					$db.saveDoc(LR);
				}
			}
		}
	});
}

function importiereLrDatensammlungen(tblName, Anz) {
	initiiereImport("importiereLrDatensammlungen_02", tblName, Anz);
}

function importiereLrDatensammlungen_02(myDB, tblName, Anz) {
	var DatensammlungMetadaten, Datensammlung, DatensammlungDieserArt, anzFelder, anzDs;
	DatensammlungMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = '" + tblName + "'");
	//Datensätze der Datensammlung abfragen
	Datensammlung = frageSql(myDB, "SELECT * FROM " + tblName + "_import");
	anzDs = 0;
	for (x in Datensammlung) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen 8000er Batches
		if ((anzDs > (Anz*2500-2500)) && (anzDs <= Anz*2500)) {
			//Datensammlung als Objekt gründen
			DatensammlungDieserArt = {};
			DatensammlungDieserArt.Typ = "Datensammlung";
			if (DatensammlungMetadaten[0].DsBeschreibung) {
				DatensammlungDieserArt.Beschreibung = DatensammlungMetadaten[0].DsBeschreibung;
			}
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
				if (y !== "GUID" && y !== "Id" && y !== "LR.Id" && Datensammlung[x][y] !== "" && Datensammlung[x][y] !== null && y !== DatensammlungMetadaten[0].DsBeziehungsfeldDs && y !== "Gruppe") {
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
				fuegeLrDatensammlungZuArt(Datensammlung[x].GUID, DatensammlungMetadaten[0].DsName, DatensammlungDieserArt);
			}
		}
	}
}

function fuegeLrDatensammlungZuArt(GUID, DsName, DatensammlungDieserArt) {
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

function importiereLrBeziehungen(tblName) {
	var qryDatensammlungenMetadaten, qryLrBeziehungenMetadaten, qryBezVonGuid, qryBezZuGuid, qryLrBez, qryAnzLrBez, anzAufrufe, myDB, viewName;
	//mit der mdb verbinden
	myDB = verbindeMitMdb();
	//Metadaten der Datensammlung abfragen
	qryDatensammlungenMetadaten = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten");
	//Metadaten für die Beziehungen abfragen
	qryLrBeziehungenMetadaten = frageSql(myDB, "SELECT * FROM tblLrBezMetadaten");
	//Liste aller GUIDS erstellen, deren Arten/LR aktualisiert werden müssen
	qryBezVonGuid = frageSql(myDB, "SELECT [von_GUID] AS [GUID] FROM " + tblName + "_import GROUP BY [von_GUID]");
	qryBezZuGuid = frageSql(myDB, "SELECT [zu_GUID] AS [GUID] FROM " + tblName + "_import GROUP BY [zu_GUID]");
	
	//viewName festlegen
	if (tblName === "tblLrFaunaBez") {
		viewName = "fauna";
	} else if (tblName === "tblLrFloraBez") {
		viewName = "flora";
	} else {
		viewName = "moose";
	}

	//Objekt "window.bezVonData" erstellen, das alle Arten enthält, die aktualisiert werden sollen
	$db = $.couch.db("artendb");
	$db.view('artendb/' + viewName + '?include_docs=true', {
		success: function (data) {
			window.bezVonData = data;
			//Objekt "window.bezZuData" erstellen, das alle LR enthält, die aktualisiert werden sollen
			$db.view('artendb/lr?include_docs=true', {
				success: function (data2) {
					//Array erstellen, der alle Docs enthält, die aktualisiert werden sollen
					//das ist eine globale Variable, weil nachher viele Funktionen damit arbeiten
					window.bezZuData = data2;

					//In Batches ausführen, damit der Arbeitsspeicher nicht überlastet wird
					//Beziehungen der Tabelle abfragen
					qryLrBez = frageSql(myDB, "SELECT * FROM " + tblName + "_import");
					//Datensätze zählen
					qryAnzLrBez = frageSql(myDB, "SELECT count([von_GUID]) AS Anzahl FROM " + tblName + "_import");
					anzLrBez = qryAnzLrBez[0].Anzahl;
					anzAufrufe = Math.ceil(anzLrBez/1250);
					for (y = 1; y <= anzAufrufe; y++) {
						importiereBatchLrBeziehungenVonTabelle(qryLrBez, qryLrBeziehungenMetadaten, qryDatensammlungenMetadaten, y, anzAufrufe);
					}
				}
			});
			
		}
	});
}

//Diese Funktion staffelt den Aufruf der folgenden Funktion, um den Arbeitsspeicher nicht zu überlasten
function importiereBatchLrBeziehungenVonTabelle(qryLrBez, qryLrBeziehungenMetadaten, qryDatensammlungenMetadaten, y, anzAufrufe) {
	//alert("qryLrBeziehungenMetadaten: " + JSON.stringify(qryLrBeziehungenMetadaten));
	if (y === 1) {
		importiereBatchLrBeziehungenVonTabelle_2(qryLrBez, qryLrBeziehungenMetadaten, qryDatensammlungenMetadaten, y);
	} else {
		//mit jeweils 5s Abstand den nächsten Batch auslösen
		setTimeout(function() {
			importiereBatchLrBeziehungenVonTabelle_2(qryLrBez, qryLrBeziehungenMetadaten, qryDatensammlungenMetadaten, y);
		}, (y-1)*5000);
	}
	//zuletzt in die DB speichern
	if (y === anzAufrufe) {
		setTimeout(function() {
			speichereBezDocs();
		}, y*5000);
	}
}

function importiereBatchLrBeziehungenVonTabelle_2(qryLrBez, qryLrBeziehungenMetadaten, qryDatensammlungenMetadaten, Anz) {
	var anzDs, LrBeziehungMetadaten, DatensammlungMetadaten, Datensammlung, Beziehung;
	anzDs = 0;
	for (x in qryLrBez) {
		anzDs += 1;
		//nur importieren, wenn innerhalb des mit Anz übergebenen Batches
		if ((anzDs > (Anz*1250-1250)) && (anzDs <= Anz*1250)) {
			//Objekt bilden mit allen Informationen
			//es kann sein, dass die Datensammlung noch nicht existiert
			//darum wird immer ein vollständiges Objekt gebildet
			//erst später, wenn das Objekt angefügt wird, wird gelöscht, was schon drin ist
			
			//Metadaten für die LrBez holen
			LrBeziehungMetadaten = {};
			//alert("qryLrBez: " + JSON.stringify(qryLrBez));
			//alert("qryLrBeziehungenMetadaten: " + JSON.stringify(qryLrBeziehungenMetadaten));
			//alert("qryDatensammlungenMetadaten: " + JSON.stringify(qryDatensammlungenMetadaten));
			for (a in qryLrBeziehungenMetadaten) {
				//alert("qryLrBez[x].von_Gruppe: " + JSON.stringify(qryLrBez[x].von_Gruppe));
				//alert("qryLrBeziehungenMetadaten[a].Gruppe: " + JSON.stringify(qryLrBeziehungenMetadaten[a].Gruppe));
				//alert("qryLrBez[x].Beziehung: " + JSON.stringify(qryLrBez[x].Beziehung));
				//alert("qryLrBeziehungenMetadaten[a].Beziehung: " + JSON.stringify(qryLrBeziehungenMetadaten[a].Beziehung));
				if (qryLrBez[x].von_Gruppe === qryLrBeziehungenMetadaten[a].Gruppe && qryLrBez[x].Beziehung === qryLrBeziehungenMetadaten[a].Beziehung) {
					LrBeziehungMetadaten = qryLrBeziehungenMetadaten[a];
					//alert("LrBeziehungMetadaten: " + JSON.stringify(LrBeziehungMetadaten));
					break;
				}
			}
			//Metadaten für die Datensammlung holen
			DatensammlungMetadaten = {};
			if (LrBeziehungMetadaten.DatensammlungGuid) {
				for (b in qryDatensammlungenMetadaten) {
					if (qryDatensammlungenMetadaten[b].GUID === LrBeziehungMetadaten.GUID) {
						DatensammlungMetadaten = qryDatensammlungenMetadaten[b];
						break;
					}
				}
			}
			//Datensammlung als Objekt gründen
			Datensammlung = {};
			Datensammlung.Typ = "Datensammlung";
			if (DatensammlungMetadaten && DatensammlungMetadaten.DsBeschreibung) {
				Datensammlung.Beschreibung = DatensammlungMetadaten.DsBeschreibung;
			}
			if (DatensammlungMetadaten && DatensammlungMetadaten.DsDatenstand) {
				Datensammlung.Datenstand = DatensammlungMetadaten.DsDatenstand;
			}
			if (DatensammlungMetadaten && DatensammlungMetadaten.DsLink) {
				Datensammlung["Link"] = DatensammlungMetadaten.DsLink;
			}
			//Für die Beziehungen dieser Datensammlung dieser Art/LR einen Array schaffen
			Datensammlung.Beziehungen = [];
			Beziehung = {};
			//Felder der Beziehung anfügen
			for (y in qryLrBez[x]) {
				if (qryLrBez[x][y]) {
					if (qryLrBez[x][y] === -1) {
						//Access macht in Abfragen mit Wenn-Klausel aus true -1 > korrigieren
						Beziehung[y] = true;
					} else if (y === "Wert") {
						//Feld wie vorgesehen beschriften
						if (LrBeziehungMetadaten.NameFürWert) {
							Beziehung[LrBeziehungMetadaten.NameFürWert] = qryLrBez[x][y];
						} else {
							//Abfangen, falls kein Name erfasst wurde
							Beziehung[y] = qryLrBez[x][y];
						}
					} else {
						//Normalfall
						Beziehung[y] = qryLrBez[x][y];
					}
				}
			}
			Datensammlung.Beziehungen.push(Beziehung);
			//Datenbankabfrage ist langsam. Extern aufrufen, 
			//sonst überholt die for-Schlaufe und Datensammlung ist bis zur saveDoc-Ausführung eine andere!
			//alert("LrBeziehungMetadaten.Datensammlung: " + LrBeziehungMetadaten.Datensammlung);
			minimiereLrBez(Datensammlung, LrBeziehungMetadaten.Datensammlung);
		}
	}
}

//reduziert das Objekt der Beziehung auf das Notwendige
function minimiereLrBez(Datensammlung, dsName) {
	var ArtDatensammlung, LrDatensammlung;
	//zuerst von = Art
	ArtDatensammlung = Datensammlung;
	for (i in ArtDatensammlung.Beziehungen[0]) {
		if (i.slice(0, 4) === "von_") {
			//von-Seite entfernen (Informationen zur Art), ist hier nicht nötig
			delete ArtDatensammlung.Beziehungen[0][i];
		}
		if (i.slice(0, 3) === "zu_") {
			//zu_ aus dem Feldnamen für die LR-Seite entfernen
			ArtDatensammlung.Beziehungen[0][i.slice(3)] = ArtDatensammlung.Beziehungen[0][i];
			delete ArtDatensammlung.Beziehungen[0][i];
		}
	}
	aktualisiereLrBez("bezVonData", ArtDatensammlung.Beziehungen[0].GUID, ArtDatensammlung, dsName);
	//jetzt zu = Lebensraum
	var LrDatensammlung = Datensammlung;
	for (i in LrDatensammlung.Beziehungen[0]) {
		if (i.slice(0, 3) === "zu_") {
			//zu-Seite entfernen, ist hier nicht nötig
			delete LrDatensammlung.Beziehungen[0][i];
		}
		if (i.slice(0, 4) === "von_") {
			//von_ entfernen
			LrDatensammlung.Beziehungen[0][i.slice(4)] = LrDatensammlung.Beziehungen[0][i];
			delete LrDatensammlung.Beziehungen[0][i];
		}
	}
	aktualisiereLrBez("bezZuData", LrDatensammlung.Beziehungen[0].GUID, LrDatensammlung, dsName);
}

//aktualisiert bezDocs
function aktualisiereLrBez(bezData, GUID, Datensammlung, dsName) {
	var doc;
	for (a in window[bezData].rows) {
		//alert(JSON.stringify(window[bezData].rows[a]));
		//alert("window[bezData].rows[a].key: " + window[bezData].rows[a].key + " GUID: " + GUID);
		//alert("dsName: " + dsName);
		//alert("Datensammlung: " + JSON.stringify(Datensammlung));
		if (window[bezData].rows[a].key === GUID) {
			doc = window[bezData].rows[a].doc;
			//Datensammlung anfügen
			if (doc[dsName]) {
				//Datensammlung existiert schon
				//kontrollieren, ob Beziehungen existieren
				if (doc[dsName].Beziehungen) {
					//Es gibt schon Beziehungen. Neue pushen
					doc[dsName].Beziehungen.push(Datensammlung.Beziehungen[0]);

				} else {
					//Es gibt noch keine Beziehungen
					doc[dsName].Beziehungen = Datensammlung.Beziehungen;
				}
			} else {
				//Datensammlung existiert noch nicht
				doc[dsName] = Datensammlung;
			}
			//alert("doc: " + JSON.stringify(doc));
			//alert("window[bezData].rows[a]: " + JSON.stringify(window[bezData].rows[a]));
			break;
		}
	}
}

function speichereBezDocs() {
	$db = $.couch.db("artendb");
	for (i in window.bezVonData.rows) {
		//alert(JSON.stringify(window.bezVonData.rows[i].doc));
		$db.saveDoc(window.bezVonData.rows[i].doc);
	}
	for (i in window.bezZuData.rows) {
		//alert(JSON.stringify(window.bezVonData.rows[i].doc));
		$db.saveDoc(window.bezZuData.rows[i].doc);
	}
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
	var DatensammlungenFlora, sqlDatensammlungenFlora, DatensammlungenFauna, sqlDatensammlungenFauna, DatensammlungenMoos, sqlDatensammlungenMoos, DatensmmlungenMacromycetes, sqlDatensammlungMacromycetes, DatensmmlungenLRs, sqlDatensammlungLR, myDB, html, qryAnzDs, anzDs, anzButtons;
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
		//jetzt LR
		sqlDatensammlungenLR = "SELECT * FROM tblDatensammlungMetadaten WHERE DsIndex = 'LR' AND DsBeziehungstyp = '1_zu_1' AND DsTabelle <> 'LR' ORDER BY DsReihenfolge";
		DatensammlungenLR = frageSql(myDB, sqlDatensammlungenLR);
		html = "LR Datensammlungen:<br>";
		for (i in DatensammlungenLR) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(" + DatensammlungenLR[i].DsBeziehungsfeldDs + ") AS Anzahl FROM " + DatensammlungenLR[i].DsTabelle);
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='";
				html += DatensammlungenLR[i].DsTabelle + y;
				html += "' name='SchaltflächeLRDatensammlung' Tabelle='" + DatensammlungenLR[i].DsTabelle;
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>";
				html += DatensammlungenLR[i].DsName;
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenLRDatensammlungen").html(html);
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
		//jetzt LR
		DatensammlungLR = frageSql(myDB, "SELECT * FROM tblDatensammlungMetadaten WHERE DsTabelle = 'LR'");
		html = "";
		for (i in DatensammlungLR) {
			//Anzahl Datensätze ermitteln
			qryAnzDs = frageSql(myDB, "SELECT Count(GUID) AS Anzahl FROM LR");
			anzDs = qryAnzDs[0].Anzahl;
			anzButtons = Math.ceil(anzDs/2500);
			for (y = 1; y <= anzButtons; y++) {
				html += "<button id='LR" + y;
				html += "' name='SchaltflächeLRIndex' Tabelle='LR";
				html += "' Anz='" + y + "' Von='" + anzButtons;
				html += "'>LR Methode";
				if (anzButtons > 1) {
					html += " (" + y + "/" + anzButtons + ")";
				}
				html += "</button>";
			}
		}
		$("#SchaltflächenLRIndex").html(html);
	} else {
		alert("Bitte den Pfad zur .mdb erfassen");
	}
}