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

    }
}
