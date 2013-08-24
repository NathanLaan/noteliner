using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace NoteLiner.App
{
    public partial class FileForm : Form
    {

        public string FilePath
        {
            get
            {
                return this.txtFilePath.Text;
            }
        }

        public FileForm()
        {
            InitializeComponent();
        }

        private void btnOK_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.OK;
            this.Close();
        }

        private void btnCancel_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }

        private void btnBrowse_Click(object sender, EventArgs e)
        {
            this.saveFileDialog.AddExtension = true;
            this.saveFileDialog.Filter = "Noteliner File (.note)|*.note";
            this.saveFileDialog.DefaultExt = "note";
            if (DialogResult.OK == this.saveFileDialog.ShowDialog(this))
            {
                this.txtFilePath.Text = this.saveFileDialog.FileName;
            }
        }
    }
}
