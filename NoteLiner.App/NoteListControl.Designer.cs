namespace NoteLiner.App
{
    partial class NoteListControl
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

        #region Component Designer generated code

        /// <summary> 
        /// Required method for Designer support - do not modify 
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.txt = new System.Windows.Forms.TextBox();
            this.lst = new System.Windows.Forms.ListBox();
            this.lstMenu = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.lstMenuDelete = new System.Windows.Forms.ToolStripMenuItem();
            this.lstMenu.SuspendLayout();
            this.SuspendLayout();
            // 
            // txt
            // 
            this.txt.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txt.Location = new System.Drawing.Point(4, 4);
            this.txt.Margin = new System.Windows.Forms.Padding(4, 4, 4, 4);
            this.txt.Name = "txt";
            this.txt.Size = new System.Drawing.Size(257, 22);
            this.txt.TabIndex = 0;
            // 
            // lst
            // 
            this.lst.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.lst.ContextMenuStrip = this.lstMenu;
            this.lst.FormattingEnabled = true;
            this.lst.IntegralHeight = false;
            this.lst.ItemHeight = 16;
            this.lst.Location = new System.Drawing.Point(5, 37);
            this.lst.Margin = new System.Windows.Forms.Padding(4, 4, 4, 4);
            this.lst.Name = "lst";
            this.lst.Size = new System.Drawing.Size(256, 328);
            this.lst.TabIndex = 1;
            // 
            // lstMenu
            // 
            this.lstMenu.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.lstMenuDelete});
            this.lstMenu.Name = "lstMenu";
            this.lstMenu.Size = new System.Drawing.Size(123, 28);
            // 
            // lstMenuDelete
            // 
            this.lstMenuDelete.Name = "lstMenuDelete";
            this.lstMenuDelete.Size = new System.Drawing.Size(122, 24);
            this.lstMenuDelete.Text = "&Delete";
            this.lstMenuDelete.Click += new System.EventHandler(this.lstMenuDelete_Click);
            // 
            // NoteListControl
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.Controls.Add(this.lst);
            this.Controls.Add(this.txt);
            this.Margin = new System.Windows.Forms.Padding(4, 4, 4, 4);
            this.Name = "NoteListControl";
            this.Size = new System.Drawing.Size(267, 369);
            this.lstMenu.ResumeLayout(false);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.TextBox txt;
        private System.Windows.Forms.ListBox lst;
        private System.Windows.Forms.ContextMenuStrip lstMenu;
        private System.Windows.Forms.ToolStripMenuItem lstMenuDelete;
    }
}
