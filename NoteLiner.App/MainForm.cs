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

        private void MainForm_Load(object sender, EventArgs e)
        {
            //
            // TODO: Check file name
            //
            if (string.IsNullOrEmpty(Settings.Default.FilePath))
            {
                FileForm fileForm = new FileForm();
                if (DialogResult.OK == fileForm.ShowDialog(this))
                {
                }
                else
                {
                    // TODO: Close application???
                }
            }
            else
            {
            }
        }

        private void noteList_NoteCreated(string title)
        {
            this.txtEdit.Focus();
        }

        private void mnuToolsViewDebugInfo_Click(object sender, EventArgs e)
        {
            this.spcHorizontal.Panel2Collapsed = !this.mnuToolsViewDebugInfo.Checked;
        }

        private void noteList_SearchTextboxLeave(string title)
        {
            this.txtDebug.AppendText("SearchTextboxLeave");
            this.txtDebug.AppendText(Environment.NewLine);
        }

        private void noteList_NoteCreated_1(string title)
        {
            this.txtDebug.AppendText("NoteCreated");
            this.txtDebug.AppendText(Environment.NewLine);
            this.txtEdit.Focus();
        }

    }
}
