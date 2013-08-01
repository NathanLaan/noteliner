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
            this.lstMenu = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.lstMenuDelete = new System.Windows.Forms.ToolStripMenuItem();
            this.txt = new System.Windows.Forms.TextBox();
            this.lst = new System.Windows.Forms.ListBox();
            this.lstMenu.SuspendLayout();
            this.SuspendLayout();
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
            // txt
            // 
            this.txt.Dock = System.Windows.Forms.DockStyle.Top;
            this.txt.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txt.Location = new System.Drawing.Point(0, 0);
            this.txt.Margin = new System.Windows.Forms.Padding(4);
            this.txt.Name = "txt";
            this.txt.Size = new System.Drawing.Size(100, 30);
            this.txt.TabIndex = 3;
            // 
            // lst
            // 
            this.lst.Dock = System.Windows.Forms.DockStyle.Fill;
            this.lst.Font = new System.Drawing.Font("Microsoft Sans Serif", 10F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lst.FormattingEnabled = true;
            this.lst.IntegralHeight = false;
            this.lst.ItemHeight = 20;
            this.lst.Location = new System.Drawing.Point(0, 30);
            this.lst.Name = "lst";
            this.lst.Size = new System.Drawing.Size(100, 270);
            this.lst.TabIndex = 5;
            // 
            // NoteListControl
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.SystemColors.Control;
            this.Controls.Add(this.lst);
            this.Controls.Add(this.txt);
            this.Margin = new System.Windows.Forms.Padding(4, 4, 4, 4);
            this.Name = "NoteListControl";
            this.Size = new System.Drawing.Size(100, 300);
            this.lstMenu.ResumeLayout(false);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.ContextMenuStrip lstMenu;
        private System.Windows.Forms.ToolStripMenuItem lstMenuDelete;
        private System.Windows.Forms.TextBox txt;
        private System.Windows.Forms.ListBox lst;
    }
}
