using Microsoft.AspNetCore.StaticFiles;

namespace ComicStrike.Server;

/// <summary>
/// Tarayıcı oyununun dosyalarını (HTML, JS, CSS) EXE'nin içinden sunar.
/// Dosyalar derleme sırasında "game/..." adıyla gömülür (bkz. .csproj) ve açılışta belleğe okunur.
/// </summary>
public sealed class EmbeddedGameFiles
{
    private readonly Dictionary<string, (byte[] Data, string ContentType)> _files = new(StringComparer.OrdinalIgnoreCase);

    public int Count => _files.Count;

    public static EmbeddedGameFiles Load()
    {
        var result = new EmbeddedGameFiles();
        var assembly = typeof(EmbeddedGameFiles).Assembly;
        var types = new FileExtensionContentTypeProvider();

        foreach (var resource in assembly.GetManifestResourceNames())
        {
            var name = resource.Replace('\\', '/');
            if (!name.StartsWith("game/", StringComparison.Ordinal)) continue;

            var path = name["game/".Length..];
            using var stream = assembly.GetManifestResourceStream(resource)!;
            using var ms = new MemoryStream();
            stream.CopyTo(ms);

            if (!types.TryGetContentType(path, out var contentType)) contentType = "application/octet-stream";
            if (contentType.StartsWith("text/") || contentType.Contains("javascript")) contentType += "; charset=utf-8";
            result._files[path] = (ms.ToArray(), contentType);
        }
        return result;
    }

    public async Task Handle(HttpContext context, RequestDelegate next)
    {
        var request = context.Request;
        if (!HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method))
        {
            await next(context);
            return;
        }

        var path = (request.Path.Value ?? "/").TrimStart('/');
        if (path.Length == 0) path = "index.html";

        if (!_files.TryGetValue(path, out var file))
        {
            if (path == "index.html")
            {
                // Oyun derlenmeden sunucu çalıştırıldıysa yol göster
                context.Response.ContentType = "text/html; charset=utf-8";
                await context.Response.WriteAsync(
                    "<h1>ComicStrike sunucusu çalışıyor</h1><p>Oyun dosyaları bulunamadı. Proje klasöründe <b>npm run build</b> çalıştırıp sunucuyu yeniden başlat.</p>");
                return;
            }
            await next(context);
            return;
        }

        // Vite dosya adlarına içerik özeti (hash) ekler; bu dosyalar asla değişmez → uzun süre önbelleğe alınabilir
        context.Response.Headers.CacheControl = path.StartsWith("assets/", StringComparison.Ordinal)
            ? "public, max-age=31536000, immutable"
            : "no-cache";
        context.Response.ContentType = file.ContentType;
        context.Response.ContentLength = file.Data.Length;
        if (HttpMethods.IsGet(request.Method)) await context.Response.Body.WriteAsync(file.Data);
    }
}
