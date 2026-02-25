using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
    options.ListenAnyIP(int.Parse(port));
});

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(opt => 
{
    opt.AddDefaultPolicy(p => p.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
    opt.AddPolicy("AllowFrontend", policy => policy.WithOrigins("https://app.up.railway.app").AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddOpenApi();

var app = builder.Build();
 
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok("Healthy"));

app.MapGet("/api/messages", async (AppDbContext db) =>
    await db.ContactMessages.OrderByDescending(m => m.CreatedUtc).ToListAsync());

app.MapGet("/api/contacts", async (AppDbContext db) =>
    await db.ContactMessages
        .OrderBy(m => m.Name)
        .Select(m => new { m.Id, m.Name })
        .ToListAsync());

app.MapPost("/api/messages", async (AppDbContext db, ContactMessage dto) =>
{
    // Minimal validation (add more as you like)
    if (string.IsNullOrWhiteSpace(dto.Name) ||
        string.IsNullOrWhiteSpace(dto.Phone) ||
        string.IsNullOrWhiteSpace(dto.Email) ||
        string.IsNullOrWhiteSpace(dto.Message))
    {
        return Results.BadRequest("All fields are required.");
    }

    var entity = new ContactMessage
    {
        Name = dto.Name.Trim(),
        Phone = dto.Phone.Trim(),
        Email = dto.Email.Trim(),
        Message = dto.Message.Trim(),
        CreatedUtc = DateTime.UtcNow
    };

    db.ContactMessages.Add(entity);
    await db.SaveChangesAsync();
    return Results.Created($"/api/messages/{entity.Id}", new { entity.Id });
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";

app.Run($"http://0.0.0.0:{port}");
