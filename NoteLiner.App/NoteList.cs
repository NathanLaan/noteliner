using System;
using System.Collections.Generic;

namespace NoteLiner.App
{
    internal class NoteList
    {

        public List<Note> List { get; set; }

        public string FilePath { get; set; }

        public void Load()
        {
        }

        public void Save()
        {
        }



        private string CreateTableNote()
        {
            string s = "CREATE TABLE [Note] ("
                        + "[ID] INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,"
                        + "[Title] VARCHAR(300)  UNIQUE NOT NULL,"
                        + "[Contents] TEXT  NULL,"
                        + "[Created] TIMESTAMP  NULL,"
                        + "[Updated] TIMESTAMP  NULL"
                        + ")";
            return s;
        }

    }
}
