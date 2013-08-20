using System;
using System.Collections.Generic;
using System.Data.SQLite;

namespace NoteLiner.App
{
    internal class NoteList
    {

        public NoteList()
        {
            this.List = new List<Note>();
        }

        public List<Note> List { get; set; }

        public string FilePath { get; set; }

        private string ConnectionString
        {
            get
            {
                return string.Format("Data Source={0}", this.FilePath);
            }
        }

        public void Load()
        {
        }

        public void Save()
        {

            // TODO: open DB connection

            using (SQLiteConnection sqliteConnection = new SQLiteConnection(this.ConnectionString))
            {

                foreach (Note note in this.List)
                {
                    if (note.Dirty)
                    {
                        //
                        // TODO: Save
                        //
                    }
                }
            }
        }



        private string CreateTableSQL_Note()
        {
            string s = "CREATE TABLE [Note] ("
                        + "[ID] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,"
                        + "[Title] VARCHAR(300) UNIQUE NOT NULL,"
                        + "[Contents] TEXT NULL,"
                        + "[Created] TIMESTAMP NULL,"
                        + "[Updated] TIMESTAMP NULL"
                        + ")";
            return s;
        }

    }
}
