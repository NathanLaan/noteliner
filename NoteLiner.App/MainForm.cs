using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Windows.Forms;
using NoteLiner.App.Properties;

namespace NoteLiner.App
{
    public partial class MainForm : Form
    {
        public MainForm()
        {
            InitializeComponent();
        }

        private void mnuFileExit_Click(object sender, EventArgs e)
        {
            this.ExitApplication();
        }

        private void ExitApplication()
        {
            //
            // TODO: wait for any save threads to complete...
            //
            // TODO: stop the document watch thread...
            //
            Application.Exit();
        }

        private void noteList_Load(object sender, EventArgs e)
        {

        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            //
            // TODO: Check file name
            //
            if (string.IsNullOrEmpty(Settings.Default.FilePath))
            {
            }
            else
            {
            }
        }

        private void noteList_NoteCreated(string title)
        {
            this.txt.Focus();
        }

    }
}
