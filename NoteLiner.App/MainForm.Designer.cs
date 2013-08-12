namespace NoteLiner.App
{
    partial class MainForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(MainForm));
            this.mnu = new System.Windows.Forms.MenuStrip();
            this.mnuFile = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuFileExit = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuTools = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuToolsOptions = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuHelp = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuHelpAbout = new System.Windows.Forms.ToolStripMenuItem();
            this.sts = new System.Windows.Forms.StatusStrip();
            this.spc = new System.Windows.Forms.SplitContainer();
            this.noteList = new NoteLiner.App.NoteListControl();
            this.txt = new System.Windows.Forms.TextBox();
            this.mnu.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.spc)).BeginInit();
            this.spc.Panel1.SuspendLayout();
            this.spc.Panel2.SuspendLayout();
            this.spc.SuspendLayout();
            this.SuspendLayout();
            // 
            // mnu
            // 
            this.mnu.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.mnuFile,
            this.mnuTools,
            this.mnuHelp});
            this.mnu.Location = new System.Drawing.Point(0, 0);
            this.mnu.Name = "mnu";
            this.mnu.Padding = new System.Windows.Forms.Padding(4, 2, 0, 2);
            this.mnu.Size = new System.Drawing.Size(466, 24);
            this.mnu.TabIndex = 0;
            this.mnu.Text = "menuStrip1";
            // 
            // mnuFile
            // 
            this.mnuFile.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.mnuFileExit});
            this.mnuFile.Name = "mnuFile";
            this.mnuFile.Size = new System.Drawing.Size(35, 20);
            this.mnuFile.Text = "&File";
            // 
            // mnuFileExit
            // 
            this.mnuFileExit.Name = "mnuFileExit";
            this.mnuFileExit.Size = new System.Drawing.Size(92, 22);
            this.mnuFileExit.Text = "E&xit";
            this.mnuFileExit.Click += new System.EventHandler(this.mnuFileExit_Click);
            // 
            // mnuTools
            // 
            this.mnuTools.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.mnuToolsOptions});
            this.mnuTools.Name = "mnuTools";
            this.mnuTools.Size = new System.Drawing.Size(44, 20);
            this.mnuTools.Text = "&Tools";
            // 
            // mnuToolsOptions
            // 
            this.mnuToolsOptions.Name = "mnuToolsOptions";
            this.mnuToolsOptions.Size = new System.Drawing.Size(111, 22);
            this.mnuToolsOptions.Text = "&Options";
            // 
            // mnuHelp
            // 
            this.mnuHelp.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.mnuHelpAbout});
            this.mnuHelp.Name = "mnuHelp";
            this.mnuHelp.Size = new System.Drawing.Size(40, 20);
            this.mnuHelp.Text = "&Help";
            // 
            // mnuHelpAbout
            // 
            this.mnuHelpAbout.Name = "mnuHelpAbout";
            this.mnuHelpAbout.Size = new System.Drawing.Size(103, 22);
            this.mnuHelpAbout.Text = "&About";
            // 
            // sts
            // 
            this.sts.Location = new System.Drawing.Point(0, 330);
            this.sts.Name = "sts";
            this.sts.Size = new System.Drawing.Size(466, 22);
            this.sts.TabIndex = 1;
            this.sts.Text = "statusStrip1";
            // 
            // spc
            // 
            this.spc.Dock = System.Windows.Forms.DockStyle.Fill;
            this.spc.Location = new System.Drawing.Point(0, 24);
            this.spc.Name = "spc";
            // 
            // spc.Panel1
            // 
            this.spc.Panel1.Controls.Add(this.noteList);
            // 
            // spc.Panel2
            // 
            this.spc.Panel2.Controls.Add(this.txt);
            this.spc.Size = new System.Drawing.Size(466, 306);
            this.spc.SplitterDistance = 149;
            this.spc.SplitterWidth = 5;
            this.spc.TabIndex = 2;
            // 
            // noteList
            // 
            this.noteList.BackColor = System.Drawing.SystemColors.Control;
            this.noteList.Dock = System.Windows.Forms.DockStyle.Fill;
            this.noteList.Location = new System.Drawing.Point(0, 0);
            this.noteList.Margin = new System.Windows.Forms.Padding(0);
            this.noteList.Name = "noteList";
            this.noteList.Size = new System.Drawing.Size(149, 306);
            this.noteList.TabIndex = 0;
            this.noteList.Load += new System.EventHandler(this.noteList_Load);
            // 
            // txt
            // 
            this.txt.Dock = System.Windows.Forms.DockStyle.Fill;
            this.txt.Font = new System.Drawing.Font("Microsoft Sans Serif", 10F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txt.Location = new System.Drawing.Point(0, 0);
            this.txt.Margin = new System.Windows.Forms.Padding(3, 3, 3, 6);
            this.txt.Multiline = true;
            this.txt.Name = "txt";
            this.txt.Size = new System.Drawing.Size(312, 306);
            this.txt.TabIndex = 0;
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(466, 352);
            this.Controls.Add(this.spc);
            this.Controls.Add(this.sts);
            this.Controls.Add(this.mnu);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MainMenuStrip = this.mnu;
            this.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.MinimumSize = new System.Drawing.Size(238, 143);
            this.Name = "MainForm";
            this.Text = "NoteLiner";
            this.Load += new System.EventHandler(this.MainForm_Load);
            this.mnu.ResumeLayout(false);
            this.mnu.PerformLayout();
            this.spc.Panel1.ResumeLayout(false);
            this.spc.Panel2.ResumeLayout(false);
            this.spc.Panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.spc)).EndInit();
            this.spc.ResumeLayout(false);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.MenuStrip mnu;
        private System.Windows.Forms.ToolStripMenuItem mnuFile;
        private System.Windows.Forms.ToolStripMenuItem mnuFileExit;
        private System.Windows.Forms.StatusStrip sts;
        private System.Windows.Forms.SplitContainer spc;
        private NoteListControl noteList;
        private System.Windows.Forms.TextBox txt;
        private System.Windows.Forms.ToolStripMenuItem mnuTools;
        private System.Windows.Forms.ToolStripMenuItem mnuToolsOptions;
        private System.Windows.Forms.ToolStripMenuItem mnuHelp;
        private System.Windows.Forms.ToolStripMenuItem mnuHelpAbout;
    }
}

