export function PlaceholderPage({ title, descricao }: { title: string; descricao: string }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl uppercase">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-xl">{descricao}</p>
      <div className="mt-8 border border-dashed border-border rounded-md p-12 text-center text-sm text-muted-foreground">
        Esta seção estará disponível nas próximas fases.
      </div>
    </div>
  );
}
