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

        private void txt_TextChanged(object sender, EventArgs e)
        {
            // TODO: filter the list

            // TODO: change list selection if no longer valid

            // TODO: fire selected changed event if needed
        }

        private void txt_Leave(object sender, EventArgs e)
        {
            // create new entry. fire event so that main form can set focus to text entry field.
            //MessageBox.Show("txt_Leave");
            this.FireSearchTextboxLeave();
        }

        private void txt_KeyUp(object sender, KeyEventArgs e)
        {
            // TODO: check for ENTER key and create new entry. fire event 
            // so that main form can set focus to text entry field.

            if (Keys.Enter == e.KeyCode)
            {
                if (this.txt.Text.Length > 0)
                {
                    this.FireCreateNoteEvent();
                }
                else
                {
                    MessageBox.Show("txt_KeyUp: Must specify title");
                }
            }
        }


        public event NoteEvent SearchTextboxLeave;

        private void FireSearchTextboxLeave()
        {
            if (this.SearchTextboxLeave != null)
            {
                this.SearchTextboxLeave(this.txt.Text);
            }
        }


        public delegate void NoteEvent(string title);

        public event NoteEvent NoteCreated;

        private void FireCreateNoteEvent()
        {
            if (this.NoteCreated != null)
            {
                this.NoteCreated(this.txt.Text);
            }
        }


    }
}
