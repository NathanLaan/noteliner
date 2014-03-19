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
            this.mnuToolsViewDebugInfo = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuHelp = new System.Windows.Forms.ToolStripMenuItem();
            this.mnuHelpAbout = new System.Windows.Forms.ToolStripMenuItem();
            this.sts = new System.Windows.Forms.StatusStrip();
            this.spcHorizontal = new System.Windows.Forms.SplitContainer();
            this.spcVertical = new System.Windows.Forms.SplitContainer();
            this.txtDebug = new System.Windows.Forms.TextBox();
            this.noteList = new NoteLiner.App.NoteListControl();
            this.textEditControl1 = new NoteLiner.Lib.TextEdit.TextEditControl();
            this.mnu.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.spcHorizontal)).BeginInit();
            this.spcHorizontal.Panel1.SuspendLayout();
            this.spcHorizontal.Panel2.SuspendLayout();
            this.spcHorizontal.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.spcVertical)).BeginInit();
            this.spcVertical.Panel1.SuspendLayout();
            this.spcVertical.Panel2.SuspendLayout();
            this.spcVertical.SuspendLayout();
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
            this.mnuFile.Size = new System.Drawing.Size(37, 20);
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
            this.mnuToolsOptions,
            this.mnuToolsViewDebugInfo});
            this.mnuTools.Name = "mnuTools";
            this.mnuTools.Size = new System.Drawing.Size(48, 20);
            this.mnuTools.Text = "&Tools";
            // 
            // mnuToolsOptions
            // 
            this.mnuToolsOptions.Name = "mnuToolsOptions";
            this.mnuToolsOptions.ShortcutKeys = ((System.Windows.Forms.Keys)(((System.Windows.Forms.Keys.Control | System.Windows.Forms.Keys.Shift) 
            | System.Windows.Forms.Keys.O)));
            this.mnuToolsOptions.Size = new System.Drawing.Size(235, 22);
            this.mnuToolsOptions.Text = "&Options";
            // 
            // mnuToolsViewDebugInfo
            // 
            this.mnuToolsViewDebugInfo.CheckOnClick = true;
            this.mnuToolsViewDebugInfo.Name = "mnuToolsViewDebugInfo";
            this.mnuToolsViewDebugInfo.ShortcutKeys = ((System.Windows.Forms.Keys)(((System.Windows.Forms.Keys.Control | System.Windows.Forms.Keys.Shift) 
            | System.Windows.Forms.Keys.D)));
            this.mnuToolsViewDebugInfo.Size = new System.Drawing.Size(235, 22);
            this.mnuToolsViewDebugInfo.Text = "&View Debug Info";
            this.mnuToolsViewDebugInfo.Click += new System.EventHandler(this.mnuToolsViewDebugInfo_Click);
            // 
            // mnuHelp
            // 
            this.mnuHelp.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.mnuHelpAbout});
            this.mnuHelp.Name = "mnuHelp";
            this.mnuHelp.Size = new System.Drawing.Size(44, 20);
            this.mnuHelp.Text = "&Help";
            // 
            // mnuHelpAbout
            // 
            this.mnuHelpAbout.Name = "mnuHelpAbout";
            this.mnuHelpAbout.ShortcutKeys = ((System.Windows.Forms.Keys)(((System.Windows.Forms.Keys.Control | System.Windows.Forms.Keys.Shift) 
            | System.Windows.Forms.Keys.A)));
            this.mnuHelpAbout.Size = new System.Drawing.Size(181, 22);
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
            // spcHorizontal
            // 
            this.spcHorizontal.Dock = System.Windows.Forms.DockStyle.Fill;
            this.spcHorizontal.Location = new System.Drawing.Point(0, 24);
            this.spcHorizontal.Name = "spcHorizontal";
            this.spcHorizontal.Orientation = System.Windows.Forms.Orientation.Horizontal;
            // 
            // spcHorizontal.Panel1
            // 
            this.spcHorizontal.Panel1.Controls.Add(this.spcVertical);
            // 
            // spcHorizontal.Panel2
            // 
            this.spcHorizontal.Panel2.Controls.Add(this.txtDebug);
            this.spcHorizontal.Panel2Collapsed = true;
            this.spcHorizontal.Size = new System.Drawing.Size(466, 306);
            this.spcHorizontal.SplitterDistance = 153;
            this.spcHorizontal.TabIndex = 3;
            // 
            // spcVertical
            // 
            this.spcVertical.Dock = System.Windows.Forms.DockStyle.Fill;
            this.spcVertical.Location = new System.Drawing.Point(0, 0);
            this.spcVertical.Name = "spcVertical";
            // 
            // spcVertical.Panel1
            // 
            this.spcVertical.Panel1.Controls.Add(this.noteList);
            // 
            // spcVertical.Panel2
            // 
            this.spcVertical.Panel2.Controls.Add(this.textEditControl1);
            this.spcVertical.Size = new System.Drawing.Size(466, 306);
            this.spcVertical.SplitterDistance = 147;
            this.spcVertical.SplitterWidth = 5;
            this.spcVertical.TabIndex = 3;
            // 
            // txtDebug
            // 
            this.txtDebug.Dock = System.Windows.Forms.DockStyle.Fill;
            this.txtDebug.Enabled = false;
            this.txtDebug.Font = new System.Drawing.Font("Microsoft Sans Serif", 10F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtDebug.Location = new System.Drawing.Point(0, 0);
            this.txtDebug.Margin = new System.Windows.Forms.Padding(3, 3, 3, 6);
            this.txtDebug.Multiline = true;
            this.txtDebug.Name = "txtDebug";
            this.txtDebug.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtDebug.Size = new System.Drawing.Size(150, 46);
            this.txtDebug.TabIndex = 1;
            // 
            // noteList
            // 
            this.noteList.BackColor = System.Drawing.SystemColors.Control;
            this.noteList.Dock = System.Windows.Forms.DockStyle.Fill;
            this.noteList.Location = new System.Drawing.Point(0, 0);
            this.noteList.Margin = new System.Windows.Forms.Padding(0);
            this.noteList.Name = "noteList";
            this.noteList.Size = new System.Drawing.Size(147, 306);
            this.noteList.TabIndex = 0;
            this.noteList.SearchTextboxLeave += new NoteLiner.App.NoteListControl.NoteEvent(this.noteList_SearchTextboxLeave);
            this.noteList.NoteCreated += new NoteLiner.App.NoteListControl.NoteEvent(this.noteList_NoteCreated_1);
            // 
            // textEditControl1
            // 
            this.textEditControl1.AutoScroll = true;
            this.textEditControl1.BackColor = System.Drawing.Color.White;
            this.textEditControl1.Cursor = System.Windows.Forms.Cursors.IBeam;
            this.textEditControl1.Font = new System.Drawing.Font("Consolas", 10F);
            this.textEditControl1.GutterColor = System.Drawing.Color.Empty;
            this.textEditControl1.Location = new System.Drawing.Point(3, 3);
            this.textEditControl1.Name = "textEditControl1";
            this.textEditControl1.Size = new System.Drawing.Size(175, 173);
            this.textEditControl1.TabIndex = 0;
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(466, 352);
            this.Controls.Add(this.spcHorizontal);
            this.Controls.Add(this.sts);
            this.Controls.Add(this.mnu);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MainMenuStrip = this.mnu;
            this.Margin = new System.Windows.Forms.Padding(2);
            this.MinimumSize = new System.Drawing.Size(235, 139);
            this.Name = "MainForm";
            this.Text = "NoteLiner";
            this.Load += new System.EventHandler(this.MainForm_Load);
            this.mnu.ResumeLayout(false);
            this.mnu.PerformLayout();
            this.spcHorizontal.Panel1.ResumeLayout(false);
            this.spcHorizontal.Panel2.ResumeLayout(false);
            this.spcHorizontal.Panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.spcHorizontal)).EndInit();
            this.spcHorizontal.ResumeLayout(false);
            this.spcVertical.Panel1.ResumeLayout(false);
            this.spcVertical.Panel2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.spcVertical)).EndInit();
            this.spcVertical.ResumeLayout(false);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.MenuStrip mnu;
        private System.Windows.Forms.ToolStripMenuItem mnuFile;
        private System.Windows.Forms.ToolStripMenuItem mnuFileExit;
        private System.Windows.Forms.StatusStrip sts;
        private System.Windows.Forms.ToolStripMenuItem mnuTools;
        private System.Windows.Forms.ToolStripMenuItem mnuToolsOptions;
        private System.Windows.Forms.ToolStripMenuItem mnuHelp;
        private System.Windows.Forms.ToolStripMenuItem mnuHelpAbout;
        private System.Windows.Forms.SplitContainer spcHorizontal;
        private System.Windows.Forms.SplitContainer spcVertical;
        private NoteListControl noteList;
        private System.Windows.Forms.TextBox txtDebug;
        private System.Windows.Forms.ToolStripMenuItem mnuToolsViewDebugInfo;
        private Lib.TextEdit.TextEditControl textEditControl1;
    }
}

