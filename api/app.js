const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bcrypt = require("bcryptjs");
const { z, regex, success } = require("zod");
const app = express();
app.use(express.json());

const uri =
  "mongodb+srv://ialfper:ialfper21@alumnos.zoinj.mongodb.net/alumnos?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("ESta conectado, Go go go go");
    const db = client.db("liga_cromos");
    return {
      usuarios: db.collection("usuarios"),
      cromos: db.collection("cromos"),
      todos_los_jugadores: db.collection("todos_jugadores"),
    };
  } catch (error) {
    console.error("Error al conectar a MongoDB:", error);
    throw new Error("Error al conectar a la base de datos");
  }
}

app.get("/api/cromos", async (req, res) => {
  try {
    const { todos_los_jugadores } = await connectToMongoDB();
    const lista_cromos = await todos_los_jugadores.find().toArray();
    //console.log(lista_clientes);

    res.json({ success: true, mensaje: "cromos aleatorios", lista_cromos });
  } catch (error) {
    res.status(400).json({ error: "Error al obtener los clientes" });
  }
});

app.post("/api/abrirsobre", async (req, res) => {
  try {
    const { todos_los_jugadores } = await connectToMongoDB();
    const { usuarios } = await connectToMongoDB();
    const code_user = req.body.code_user;

    const lista_sobres = await todos_los_jugadores.find().toArray();
    const sobre_cartas = lista_sobres
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);

    const usuario = await usuarios.findOne({ code_user: code_user });

    if (!usuario) {
      return res
        .status(404)
        .json({ success: false, mensaje: "Usuario no encontrado" });
    }

    /*
    const cromo_usuario = {
      nombre:sobre_cartas[j].nombre,
      apellidos:sobre_cartas[j].apellidos,
      liga:sobre_cartas[j].liga,
      equipo:sobre_cartas[j].equipo,
      imagenUrl:sobre_cartas[j].imagenUrl,
      imagen_seleccion:sobre_cartas[j].imagen_seleccion,
      repetidas:0
    }
    */
    // comparar si esta el cromo

    for (let j = 0; j < sobre_cartas.length; j++) {
      const cada_jugador = sobre_cartas[j];

      let esta = false;
      for (let i = 0; i < usuario.lista_cromos.length; i++) {
        if (usuario.lista_cromos[i].nombre_jugador === cada_jugador.nombre_jugador) {
          esta = true;
          break;
        }
      }

      if (esta) {
        await usuarios.updateOne(
          { code_user: code_user, "lista_cromos.nombre_jugador": cada_jugador.nombre_jugador },
          { $inc: { "lista_cromos.$.repetidas": 1 } },
        );
      } else {
        const cromo_usuario = {
          nombre_jugador: sobre_cartas[j].nombre_jugador,
          imagen_player: sobre_cartas[j].imagen_player,
          logo_seleccion: sobre_cartas[j].logo_seleccion,
          repetidas: 0,
        };

        await usuarios.updateOne(
          { code_user: code_user },
          { $push: { lista_cromos: cromo_usuario } },
        );
      }
    }

    const user = await usuarios.findOne({ code_user: code_user });
    let total_cartas = 0;
    let total_repetidas = 0;

    for (let i = 0; i < user.lista_cromos.length; i++) {
      total_repetidas = total_repetidas + user.lista_cromos[i].repetidas;
      total_cartas = user.lista_cromos.length + total_repetidas;
    }

    await usuarios.updateOne(
      { code_user: code_user },

      {
        $inc: { "estadisticas.sobres_abiertos": 1 },
        $set: {
          "estadisticas.cartas_totales": total_cartas,
          "estadisticas.cartas_repetidas": total_repetidas,
        },
      },
    );

    res.json({
      success: true,
      mensaje: "cromos aleatorios",
      sobre_cartas,
      lista_cromos: usuario.lista_cromos,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({ error: "Error al obtener los cromos" });
  }
});

//datos usuarios


app.get("/api/datosusuarios/:code_user", async (req, res) => {
  try {
    const code_user = req.params.code_user;
    console.log("obteniendo datos del usuario con code_user:", code_user);
    const { usuarios } = await connectToMongoDB();
    //busdcar usuario
    const usuario = await usuarios.findOne({ code_user });
    //console.log(lista_clientes);

    res.json({
      success: true,
      mensaje: "lista cromos usuario",
      estadisticas: usuario.estadisticas,
      lista_cromos: usuario.lista_cromos,
    });
  } catch (error) {
    res.status(400).json({ error: "Error al obtener los clientes" });
  }
});

//api login
app.post("/api/login", async (req, res) => {
  try {
    const { correo, password } = req.body;

    console.log("Intentando login para:", correo);

    // Conectar a MongoDB
    const { usuarios } = await connectToMongoDB();

    //buscar usuario
    const usuario = await usuarios.findOne({ correo });

    // si existe usuario
    if (!usuario) {
      console.log("Usuario no encontrado");
      return res.status(401).json({
        success: false,
        message: "No existe este usuario, crea uno",
      });
    }

    // comparar contraseñas con bcrypt
    const contraseñaValida = await bcrypt.compare(password, usuario.password);

    if (!contraseñaValida) {
      console.log("Contraseña incorrecta");
      return res.status(401).json({
        success: false,
        message: "Correo o contraseña incorrectas",
      });
    }

    console.log("Login exitoso para:", usuario.nombre);

    const respuesta = {
      success: true,
      message: "Inicio Sesion Exitoso",
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        lista_cromos: usuario.lista_cromos,
        lista_repetidos: usuario.lista_repetidos,
        estadisticas: usuario.estadisticas,
        code_user: usuario.code_user,
      },
    };

    
    res.json(respuesta);
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});
// registro
app.post("/api/registro", async (req, res) => {
  try {
    const { nombre, correo, password1, password2 } = req.body;

    console.log(nombre, correo, password1, password2);

    const { usuarios } = await connectToMongoDB();
    // validacion con zod

    const resultado = z
      .object({
        nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
        correo: z.email("Correo electrónico inválido"),
        password1: z
          .string()
          .min(3, "La contraseña debe tener al menos 3 caracteres"),
        password2: z
          .string()
          .min(3, "La contraseña debe tener al menos 3 caracteres"),
        //validaciones personalizadas en vez de las .min que son predefinidas de zod
      })
      .refine((data) => data.password1 === data.password2, {
        message: "Las contraseñas no coinciden",
        path: ["password2"],
      })
      .safeParse({ nombre, correo, password1, password2 });

    if (!resultado.success) {
      console.log("sisis zod");
      const primerError = resultado.error?.issues?.[0]?.message;
      console.log(primerError);

      return res.status(400).json({
        success: false,
        message: primerError,
      });
    }

    // Verificar contraseñas
    if (password1 !== password2) {
      return res.status(400).json({
        success: false,
        message: "Las contraseñas no coinciden",
      });
    }

    // Verificar correo duplicado
    const usuarioExistente = await usuarios.findOne({ correo });
    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        message: "El correo ya está registrado",
      });
    }

    // Hashear contraseña
    const saltRounds = 10;

    const contraseñaHasheada = await bcrypt.hash(password1, saltRounds);

    const code_user = "Codigo" + Math.floor(Math.random() * 1000);

    const nuevoUsuario = {
      nombre,
      correo,
      password: contraseñaHasheada,
      code_user,
      estadisticas:{
        sobres_abiertos:0,
        cartas_totales:0,
        cartas_repetidas:0
      },
      lista_cromos: [],
    };

    await usuarios.insertOne(nuevoUsuario);

    // devolver respuesta
    res.json({
      success: true,
      message: "Usuario creado exitosamente",
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

app.post("/api/intercambio", async (req, res) => {
  try {
    const { usuarios } = await connectToMongoDB();
    const { primerSeleccionado, segundoSeleccionado, code_user } = req.body;
    const usuario = await usuarios.findOne({ code_user });

    let lista_cromos_usuario = usuario.lista_cromos;
    let esta = false;
    
    console.log("primerSeleccionado ", primerSeleccionado.nombre_jugador);
    console.log("segundoSeleccionado", segundoSeleccionado.nombre_jugador);
    
    // Buscar si el primer seleccionado ya está en la lista
    for (let i = 0; i < lista_cromos_usuario.length; i++) {
      if (primerSeleccionado.nombre_jugador == lista_cromos_usuario[i].nombre_jugador) {
        esta = true;
        break;
      }
    }
    
   
    const resultadoResta = await usuarios.updateOne(
      {
        code_user: code_user,
        "lista_cromos.nombre_jugador": segundoSeleccionado.nombre_jugador,
      },
      { $inc: { "lista_cromos.$.repetidas": -1, "estadisticas.repetidas": -1 } },

    );
    
  
  
    
    
    if (esta) {
      // Si ya lo tiene, incrementar repetidas
      await usuarios.updateOne(
        {
          code_user: code_user,
          "lista_cromos.nombre_jugador": primerSeleccionado.nombre_jugador,
        },
        { $inc: { "lista_cromos.$.repetidas": 1 } },
      );


      console.log("Incrementado:", primerSeleccionado.nombre_jugador);
    } else {
      // si no lo tiene, crear nuevo cromo
      const intercambio_nuevo_cromos = {
        nombre_jugador: primerSeleccionado.nombre_jugador,
        imagen_player: primerSeleccionado.imagen_player,
        logo_seleccion: primerSeleccionado.logo_seleccion,
        repetidas: 0
      };
      
      await usuarios.updateOne(
        { code_user: code_user },
        { $push: { lista_cromos: intercambio_nuevo_cromos } },
      );
      console.log("Creado nuevo:", primerSeleccionado.nombre_jugador);
    }
    
    // Respuesta unica al final
    return res.json({ success: true, mensaje: "intercambio exitoso" });
    
  } catch (error) {
    console.error("Error en intercambio:", error);
    return res.json({ success: false, mensaje: "Error en el servidor: " + error.message });
  }
});

app.get("/api/tienda", async (req, res) => {
  try {
    const { usuarios } = await connectToMongoDB();
    const { todos_los_jugadores } = await connectToMongoDB();
    // cartas aleatorias

    const lista_sobres = await todos_los_jugadores.find().toArray();

    const cartas_tienda = lista_sobres
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    res.json({
      success: true,
      cartas_random: cartas_tienda,
    });
  } catch (error) {}
});





module.exports = app;
