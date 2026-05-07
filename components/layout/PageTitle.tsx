type Props = {
  children: React.ReactNode;
};

export default function PageTitle({ children }: Props) {
  return (
    <h1 className="text-4xl font-extrabold leading-tight">{children}</h1>
  );
}
