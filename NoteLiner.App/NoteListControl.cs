using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Data;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace NoteLiner.App
{
    public partial class NoteListControl : UserControl
    {

        internal List<Note> NoteList { get; private set; }

        public NoteListControl()
        {
            InitializeComponent();
            this.NoteList = new List<Note>();
        }

        //
        // TODO: Events
        //

        // SelectedNoteChanged(Note note)

        public void UpdateSelectedNote(string contents)
        {
            // NOTE: Update DateTime as well...
            // NOTE: Mark as Dirty...
        }

        private void lstMenuDelete_Click(object sender, EventArgs e)
        {
            MessageBox.Show("Delete");
        }

    }
}
