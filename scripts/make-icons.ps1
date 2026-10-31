# Regenerate from the exact S cropped from the supplied official PulSe artwork.
Add-Type -AssemblyName System.Drawing
$repo = Split-Path $PSScriptRoot -Parent
$glyph = [System.Drawing.Bitmap]::new((Join-Path $repo 'assets/pulse-s-source.png'))
try {
  foreach ($size in @(192,512)) {
    foreach ($maskable in @($false,$true)) {
      $bitmap = [System.Drawing.Bitmap]::new($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#070c14'))
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        # A .60h x .526w rectangle fits wholly inside the .40r maskable circle.
        $height = [single]($size * $(if ($maskable) { 0.60 } else { 0.86 }))
        $width = [single]($height * $glyph.Width / $glyph.Height)
        $dest = [System.Drawing.RectangleF]::new(($size-$width)/2,($size-$height)/2,$width,$height)
        $graphics.DrawImage($glyph,$dest,[System.Drawing.RectangleF]::new(0,0,$glyph.Width,$glyph.Height),[System.Drawing.GraphicsUnit]::Pixel)
        $name = if ($maskable) { "icon-maskable-$size.png" } else { "icon-$size.png" }
        $bitmap.Save((Join-Path $repo $name),[System.Drawing.Imaging.ImageFormat]::Png)
      } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
  }
  $png = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $repo 'icon-192.png')))
  $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,'+$png+'"/></svg>'
  [IO.File]::WriteAllText((Join-Path $repo 'icon.svg'),$svg,[System.Text.UTF8Encoding]::new($false))
} finally { $glyph.Dispose() }
