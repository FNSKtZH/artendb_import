Die Fachstelle Naturschutz des Kantons Zürich hat die [Artendatenbank](http://www.aln.zh.ch/internet/baudirektion/aln/de/naturschutz/naturschutzdaten/tools/arten_db.html#a-content) entwickelt, in der Eigenschaften von Arten und Lebensräumen verwaltet werden. Sie basiert auf Microsoft Access.

Ich versuche, eine bessere Lösung mit Javascript und [CouchDb](http://couchdb.apache.org/) zu entwickeln.
Dazu müssen zunächst die Daten aus Access im [JSON-Format](http://de.wikipedia.org/wiki/JavaScript_Object_Notation) in die Couch importiert werden.

Idee:

- In Access wird eine Import-mdb erstellt, welche die Tabellen der ArtenDb.mdb einbindet und daraus Importtabellen generiert
- Eine [CouchApp](http://couchapp.org) verbindet mit den gewählten Tabellen der Access-Datenbank
- Sie wandelt die Arten- und Lebensraumeigenschaften ins JSON-Format um und importiert sie in die CouchDb-Datenbank [der künftigen Artendatenbank](https://github.com/FNSKtZH/artendb)
- In der künftigen ArtenDb kann man csv-Dateien uploaden und daraus Taxonomien, Eigenschaften und Beziehungen importieren. Das funktioniert dann ohne ActiveX und ohne die nachfolgend beschriebenen Probleme

Voraussetzungen:

- Der direkte Zugriff auf lokale Daten ist Web-Anwendungen normalerweise verwehrt. Darum wird ActiveX verwendet, was die Verwendung des Internet Explorers voraussetzt
- Die Anwendung greift gleichzeitig auf lokale Daten und auf die CouchApp im Netz zu. Dieser "crossdomain"-Zugriff ist bei unbekannten Seiten ein Sicherheitsrisiko. Darum muss diese Seite in den Optionen des Internet Explorers als sichere Seite eingestellt werden und crossdomain für sichere Seiten freigegeben werden

Wie so oft, wenn komplexe Daten importiert werden müssen, unterschätzt man diesen Aufwand. Für die ArtenDb ist der Import der zentrale Vorgang, da sich die ganze Logik der Anwendung aus der Datenstruktur ableitet und die Benutzeroberfläche dynamisch daraus aufgebaut wird. Entsprechend steckt hier trotz der kurzen Beschreibung der Kern der [ArtenDb](https://github.com/FNSKtZH/artendb)...