using System;
using System.Data.SQLite;

namespace NoteLiner.App
{
    internal class Note
    {

        public bool Dirty { get; set; }
        public int ID { get; set; }
        public string Title { get; set; }
        public string Contents { get; set; }
        public DateTime Created { get; set; }
        public DateTime Updated { get; set; }


        #region SQL
        
        private static readonly string SQL_INSERT
            = "INSERT INTO [Note] Title,Contents,Created,Updated"
            + " VALUES(@Title,@Contents,@Created,@Updated);"
            + " SELECT last_insert_rowid();";
        private static readonly string SQL_UPDATE
            = "UPDATE [Note] SET Title=@Title, Contents=@Contents, Created=@Created, Updated=@Updated"
            + " WHERE ID=@ID;";
        
        #endregion


        public void Save(SQLiteConnection sqliteConnection)
        {
            sqliteConnection.Open();
            SQLiteCommand sqlCommand = new SQLiteCommand(SQL_INSERT, sqliteConnection);
            sqlCommand.Parameters.AddWithValue("@ID", ID);
            sqlCommand.Parameters.AddWithValue("@Title", Title);
            sqlCommand.Parameters.AddWithValue("@Contents", Contents);
            sqlCommand.Parameters.AddWithValue("@Created", Created);
            sqlCommand.Parameters.AddWithValue("@Updated", Updated);
            sqlCommand.ExecuteNonQuery();
        }

        public void Insert(SQLiteConnection sqliteConnection)
        {
            sqliteConnection.Open();
            SQLiteCommand sqlCommand = new SQLiteCommand(SQL_INSERT, sqliteConnection);
            sqlCommand.Parameters.AddWithValue("@Title", Title);
            sqlCommand.Parameters.AddWithValue("@Contents", Contents);
            sqlCommand.Parameters.AddWithValue("@Created", Created);
            sqlCommand.Parameters.AddWithValue("@Updated", Updated);
            object returnValue = sqlCommand.ExecuteScalar();
            this.ID = int.Parse(returnValue.ToString());
        }

    }
}
